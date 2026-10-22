// llmEngine.ts — Motor único de llamadas a Gemini con fallback de modelos.
// VERSION CONSOLIDADA (Fase 1): la copia completa que vivia en server.ts se
// traslada aqui y server.ts + legalhelp-draft.ts importan de este modulo.
// Caracteristicas: cadena dinamica de modelos (auto-listado con cache 6h),
// pausa por cuota diaria agotada por modelo+key, reintentos con backoff,
// exigencia de grounding con fallback degradado, y errores tipados que los
// endpoints traducen a 429 amigable.
// La logica de /api/premium-report NO cambia: es la misma implementacion,
// solo movida de archivo.

import type { GoogleGenAI } from "@google/genai";

// Reintento + cadena de modelos de respaldo ante errores de Gemini.
// Cada modelo free-tier tiene su propia cuota DIARIA (~20 req/dia). Si uno se agota,
// saltamos al siguiente al instante (reintentar el mismo es inutil hasta ~5h despues).
// Orden verificado empiricamente (2026-10-14): fuertes primero (saltan rapido si 429),
// lites siempre disponibles, nuevos al final (suelen dar 503 "high demand").
// NOTA: pro/omni NO tienen cuota free (limit: 0) y gemini-2.5-pro devolvio 404.
export const GEMINI_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];
const RETRYABLE_STATUS = new Set([500, 502, 503]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Error lanzado cuando TODOS los modelos agotaron su cuota diaria. */
export class GeminiQuotaExhaustedError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Cuota diaria de IA agotada en todos los modelos.");
    this.name = "GeminiQuotaExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Error lanzado cuando toda la cadena fallo (saturacion/indisponibilidad transitoria). */
export class GeminiUnavailableError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds = 30 * 60) {
    super("Servicio de IA temporalmente no disponible en todos los modelos.");
    this.name = "GeminiUnavailableError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isDailyQuotaError(err: any): boolean {
  const msg = String(err?.message || "");
  return (
    /RESOURCE_EXHAUSTED/i.test(msg) ||
    /quota exceeded/i.test(msg) ||
    /generate_content_free_tier_requests/i.test(msg) ||
    /per_day|PerDay|per project per model/i.test(msg)
  );
}

/** Extrae el retryDelay (segundos) que Google sugiere para cuotas diarias. */
function parseRetryDelaySeconds(err: any): number {
  const msg = String(err?.message || "");
  const m = msg.match(/retry(?:Delay)?[":\s]+(\d+)\s*s/i) || msg.match(/Please retry in (\d+)h/);
  if (m) {
    const n = parseInt(m[1], 10);
    // Si matcheo "Nh" convertir a segundos
    if (/Please retry in/i.test(msg) && /h/.test(m[0])) return n * 3600;
    return n;
  }
  // Fallback conservador: ~5 horas
  return 5 * 3600;
}

// Auto-deteccion de modelos vivos: consultamos la API que modelos existen hoy
// y filtramos la cadena. Evita fallar con 404 cuando Google descontinua un modelo.
let availableModelsCache: { names: Set<string> | null; expires: number } = { names: null, expires: 0 };
const MODEL_LIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function getAvailableChain(ai: GoogleGenAI): Promise<string[]> {
  try {
    if (availableModelsCache.names && Date.now() < availableModelsCache.expires) {
      const ok = GEMINI_MODEL_CHAIN.filter((m) => availableModelsCache.names!.has(m));
      return ok.length ? ok : GEMINI_MODEL_CHAIN;
    }
    const names = new Set<string>();
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m?.name) names.add(String(m.name).replace(/^models\//, ""));
    }
    if (names.size === 0) return GEMINI_MODEL_CHAIN;
    availableModelsCache = { names, expires: Date.now() + MODEL_LIST_TTL_MS };
    const ok = GEMINI_MODEL_CHAIN.filter((m) => names.has(m));
    console.warn(`[gemini] modelos de la cadena disponibles: ${ok.length}/${GEMINI_MODEL_CHAIN.length}`);
    return ok.length ? ok : GEMINI_MODEL_CHAIN;
  } catch (err: any) {
    console.warn(`[gemini] no se pudo listar modelos, se usa la cadena completa: ${String(err?.message || err).slice(0, 200)}`);
    return GEMINI_MODEL_CHAIN;
  }
}

// Cuota diaria agotada por modelo+key: evitamos re-reintentar hasta que Google la libere.
const modelQuotaUntil = new Map<string, number>(); // `${keyIdx}:${model}` -> timestamp (ms)
const MODEL_QUOTA_MAX_PAUSE_MS = 12 * 60 * 60 * 1000; // tope 12h por si el retryDelay viene raro

export async function generateWithFallback(
  clients: GoogleGenAI | GoogleGenAI[],
  payload: { contents: any; config?: any },
  opts?: {
    /** Exige que la respuesta traiga groundingChunks (busqueda ejecutada);
     *  si un modelo responde sin busqueda, se descarta y sigue la cadena. */
    requireGrounding?: boolean;
    /** Excluye los modelos *-lite (no ejecutan googleSearch -> nunca dan fuentes). */
    skipLite?: boolean;
  }
) {
  const clientList = Array.isArray(clients) ? clients : [clients];
  const fullChain = await getAvailableChain(clientList[0]);
  const chain = opts?.skipLite ? fullChain.filter((m) => !/lite/i.test(m)) : fullChain;
  let lastErr: any;
  let quotaErrors = 0;
  let maxRetryAfter = 0;
  /** Respuesta valida pero SIN grounding: se conserva como fallback final. */
  let degradedNoGrounding: any = null;

  for (let keyIdx = 0; keyIdx < clientList.length; keyIdx++) {
    const ai = clientList[keyIdx];
    for (const model of chain) {
      // Modelo con cuota diaria pausada: saltar sin llamar (ahorra latencia).
      const cacheKeyQM = `${keyIdx}:${model}`;
      const until = modelQuotaUntil.get(cacheKeyQM) || 0;
      if (until > Date.now()) {
        quotaErrors++;
        maxRetryAfter = Math.max(maxRetryAfter, Math.round((until - Date.now()) / 1000));
        continue;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ok = await ai.models.generateContent({ model, ...payload } as any);
          if (opts?.requireGrounding) {
            const chunks = (ok as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            if (chunks.length === 0) {
              // El modelo respondio SIN invocar googleSearch (indeterminismo).
              // Reintentar en el mismo modelo hasta 3 veces antes de pasar de modelo:
              // en pruebas, 2 de 3 intentos si ejecutaban la busqueda.
              console.warn(`[gemini] key${keyIdx} ${model}: groundingChunks=0 (no ejecuto la busqueda), intento ${attempt + 1}/3.`);
              if (!degradedNoGrounding) degradedNoGrounding = ok;
              if (attempt < 2) {
                await sleep(700);
                continue; // reintenta mismo modelo
              }
              break; // modelo no busca ni reintentando: siguiente modelo
            }
          }
          if (!process.env.GEMINI_QUIET_OK) console.warn(`[gemini] OK key${keyIdx} ${model}`);
          return ok;
        } catch (err: any) {
          lastErr = err;
          const status = Number(err?.status ?? err?.code);
          const msg = String(err?.message || "");
          console.warn(`[gemini] key${keyIdx} ${model} intento ${attempt + 1}/3 fallo (status=${status}): ${msg.slice(0, 300)}`);

          // Cuota DIARIA agotada: no reintentar este modelo, saltar al siguiente al instante.
          if (status === 429 && isDailyQuotaError(err)) {
            quotaErrors++;
            const retryAfter = parseRetryDelaySeconds(err);
            maxRetryAfter = Math.max(maxRetryAfter, retryAfter);
            modelQuotaUntil.set(cacheKeyQM, Date.now() + Math.min(retryAfter * 1000, MODEL_QUOTA_MAX_PAUSE_MS));
            console.warn(`[gemini] key${keyIdx} ${model}: cuota diaria agotada, saltando al siguiente modelo.`);
            break; // sale del loop de intentos -> pasa al siguiente modelo del chain
          }

          // 429 transitorio (rate limit por minuto): backoff corto y reintentar.
          if (status === 429) {
            await sleep(1500 * (attempt + 1));
            continue;
          }

          // Errores 5xx transitorios: backoff exponencial.
          if (RETRYABLE_STATUS.has(status) || /UNAVAILABLE|high demand|overloaded/i.test(msg)) {
            await sleep(1200 * 2 ** attempt);
            continue;
          }

          // Error no transitorio (400/404 modelo inexistente, etc.): probar siguiente modelo.
          break;
        }
      }
    }
  }

  // Si todas las respuestas validas carecian de grounding, devolver la mejor
  // degradada en vez de fallar (el endpoint igual extraera 0 fuentes).
  if (degradedNoGrounding) return degradedNoGrounding;

  // TODOS los modelos fallaron (el loop no hizo return en ninguno).
  const finalStatus = Number(lastErr?.status ?? lastErr?.code);
  // Error del cliente (payload invalido): propagar sin enmascarar.
  if (finalStatus === 400 || finalStatus === 413) throw lastErr;
  // Si hubo cuota diaria agotada en al menos un modelo -> 429 amigable.
  if (quotaErrors > 0) {
    throw new GeminiQuotaExhaustedError(maxRetryAfter || 5 * 3600);
  }
  // Resto (404/5xx en toda la cadena): saturacion transitoria -> 429 con CTA
  // en vez del 500 generico "Error procesando...".
  throw new GeminiUnavailableError();
}
