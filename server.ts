import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import crypto from "crypto";
import { saveOrder, getOrderByOrderId, getOrderByPreferenceId, updateOrder, consumeUseAtomic, dbUrl } from "./src/lib/orderStore.js";
import { checkRateLimit, getClientIp, PAYMENT_RATE_LIMIT, ANALYZE_RATE_LIMIT, GENERAL_API_RATE_LIMIT } from "./src/lib/rateLimit.js";
import { generateWithFallback, GeminiQuotaExhaustedError, GeminiUnavailableError } from "./src/server/llmEngine.js";
import { SEO_PAGES } from "./src/data/seoPages.js";
import { SEO_PAGES_EXTRA } from "./src/data/seoPagesExtra.js";
import { SEO_PAGES_BATCH2 } from "./src/data/seoPagesBatch2.js";
import { resolvePseoRedirect } from "./src/data/redirects.js";
import { ALL_SEO_PAGES as ALL_SEO_PAGES_SHARED, renderHomeContent } from "./src/lib/homeSsr.js";
import { CALCULATOR_PAGES, getCalculatorPage } from "./src/data/calculators.js";
import { COMUNAS_RM } from "./src/data/tribunales.js";
import { verificarCitasBCN, bloquePromptBCN } from "./bcnLeyChile.js";
import { buscarJurisprudencia, bloquePromptJuris, resumenJuris, buscarCasosJuris, bloquePromptCasos, resumenCasos, buscarJurisprudenciaMulti, buscarCasosJurisMulti, esSlugCorpusArea, type ConsultaEtiquetada } from "./jurisprudenciaChile.js";
import { extraerChileno, planoBlindajePrompt } from "./extractorChile.js";
import { validarInforme, notaBlindajeReporte } from "./validadorInforme.js";
import { handleLegalHelpDraft } from "./src/server/legalhelp-draft.js";
import { detectarArea, detectAreaFromContext } from "./area-detector.js";
import type { DraftInput } from "./src/types.js";

// Combinación de TODAS las páginas SEO: 21 originales + 45 + 20 = 86 páginas (+home = 87 URLs)
const ALL_SEO_PAGES = ALL_SEO_PAGES_SHARED;

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security: disable X-Powered-By header
app.disable("x-powered-by");

app.use(express.json({ limit: "50mb" }));

// SEO: eliminar soft-duplicates por query string (utm, fbclid, p=, s=, page=, etc.)
// excepto los parametros que usa la app (payment/orderId del redirect de MercadoPago).
const ALLOWED_QUERY_PARAMS = new Set(["payment", "orderId"]);
app.use((req, res, next) => {
  const queryKeys = Object.keys(req.query);
  if (queryKeys.length > 0 && queryKeys.some(k => !ALLOWED_QUERY_PARAMS.has(k))) {
    const cleanUrl = `${req.protocol}://${req.get("host")}${req.path}`;
    return res.redirect(301, cleanUrl);
  }
  next();
});

// Initialize MercadoPago client (token SOLO desde variables de entorno, nunca hardcodeado)
const envToken = process.env.MP_ACCESS_TOKEN;
const mpAccessToken = (envToken && (envToken.startsWith("APP_USR-") || envToken.startsWith("TEST-")))
  ? envToken
  : undefined;
const isMpConfigured = Boolean(mpAccessToken);
const isSandbox = Boolean(mpAccessToken && mpAccessToken.startsWith("TEST-"));
const mp = isMpConfigured && mpAccessToken ? new MercadoPagoConfig({ accessToken: mpAccessToken }) : null;

// Fase 0: precio y título del dictamen VIVEN EN EL SERVIDOR. El cliente nunca
// debe poder fijarlos (se ignora amount/title del body en /api/payment/create).
const PRECIO_DICTAMEN = 19990;
const TITULO_DICTAMEN = "Dictamen Técnico Legal Completo";

// Initialize Gemini API (soporta MÚLTIPLES keys: GEMINI_API_KEYS separadas por coma,
// multiplica la cuota diaria free-tier por número de cuentas/proyectos).
const getGeminiClients = (): GoogleGenAI[] => {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = raw
    .split(",")
    .map((k) => k.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  if (!keys.length) {
    console.warn("GEMINI_API_KEY no configurada en las variables de entorno.");
    return [new GoogleGenAI({ apiKey: "" })];
  }
  if (keys.length > 1) {
    console.warn(`[gemini] ${keys.length} API keys configuradas (cuota x${keys.length}).`);
  }
  return keys.map(
    (apiKey) =>
      new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
  );
};


// ========== CACHÉ DE RESPUESTAS IDENTÍCTICAS (ahorra cuota free-tier) ==========
const responseCache = new Map<string, { text: string; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("||")).digest("hex").slice(0, 32);
}

function getCached(key: string): string | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return null;
  }
  return hit.text;
}

function setCached(key: string, text: string) {
  // Evitar que el caché crezca sin límite
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (v.expires < now) responseCache.delete(k);
    }
    // Si sigue lleno, borrar las entradas más antiguas
    if (responseCache.size > 500) {
      const first = responseCache.keys().next().value;
      if (first) responseCache.delete(first);
    }
  }
  responseCache.set(key, { text, expires: Date.now() + CACHE_TTL_MS });
}

const SYSTEM_INSTRUCTION_LAWYER = `Eres un Abogado Litigante Senior en Chile, experto en derecho civil, laboral, penal y de familia, con profundo conocimiento del funcionamiento del Poder Judicial (PJUD) y la Oficina Judicial Virtual (OJV).

Tu objetivo es analizar los documentos legales (resoluciones, demandas, notificaciones) subidos por el usuario, cruzar esa información con el relato de su problema, y entregar un diagnóstico legal preciso, estructurado y en lenguaje comprensible para una persona sin estudios de derecho.

REGLAS ESTRICTAS DE OPERACIÓN (CUMPLIMIENTO OBLIGATORIO):
1. CERO ALUCINACIONES DE PLAZOS: Los plazos en Chile son fatales. Si identificas un plazo para contestar, apelar o presentar pruebas, debes citar el artículo exacto del código respectivo (Ej: Código de Procedimiento Civil Art. 258, Art. 303, Art. 462; Código del Trabajo Art. 453, Art. 480, Art. 510; Ley 19.968 de Familia Art. 58, Art. 67; Código Procesal Penal Art. 366; Ley 18.287 de Juzgados de Policía Local, etc.) y advertir claramente si los días son hábiles (lunes a sábado según el CPC Art. 66, o lunes a viernes en procedimiento laboral/administrativo) o corridos. Si el documento no especifica la fecha de notificación, debes indicar explícitamente que el plazo fatídico comienza a correr desde el día siguiente a la notificación legal.
2. NEUTRALIDAD Y PRECISIÓN: No des falsas esperanzas. Si la situación es grave (ej. embargo inminente, citación bajo apercibimiento de arresto, lanzamiento con fuerza pública, declaración de rebeldía), dilo con absoluta claridad y urgencia en **negritas**.
3. LENGUAJE CLARO: Traduce el "leguleyo" (jerga legal procesal chilena) a español simple y coloquial chileno comprensible. Explica qué significa términos como "traslado", "autos en relación", "rebeldía", "despáchese mandamiento de ejecución y embargo", "resolución que cita a audiencia de juicio", "concluidos para fallo", "reserva de derechos", etc., si aparecen en el texto o la causa.
4. DESCARGO DE RESPONSABILIDAD: Siempre debes incluir la advertencia obligatoria de que este análisis es una orientación inicial basada en IA y no reemplaza el patrocinio y poder de un abogado habilitado para el ejercicio de la profesión en Chile.

ESTRUCTURA OBLIGATORIA DE TU RESPUESTA:
Debes responder SIEMPRE utilizando estrictamente la siguiente estructura en formato Markdown:

## 1. Resumen de tu Situación Legal
[Explica en 2-3 párrafos de qué se trata la demanda o resolución recibida, integrando el relato del usuario y los datos del documento (RIT/ROL, Tribunal, demandante, materia). NO uses saludos formales (ej: "Estimado cliente", "Estimado usuario", "Estimado/a cliente"); entra directo al contenido].

## 2. Normativa y Leyes Aplicables
[Enumera en viñetas las leyes principales que rigen este caso en Chile. Ej: Ley 19.968 que crea los Tribunales de Familia, Código de Procedimiento Civil, Código del Trabajo, Ley 18.287, etc. Explica brevemente por qué aplican a su situación].

## 3. Plazos Críticos (Plazos Fatales)
[Identifica exactamente qué acciones deben tomarse y en cuánto tiempo. Cita los artículos legales exactos. Advierte explícitamente si son días hábiles (lunes a sábado según el CPC Art. 66, o lunes a viernes en laboral/administrativo) o corridos. Si hay riesgo de embargo, pérdida de derechos o rebeldía por inacción, destácalo en **negritas**].

## 4. Riesgos Actuales
[Comienza ENUMERANDO EN VIÑETAS los 2 o 3 riesgos más severos identificados en la demanda o resolución, ordenados de mayor a menor gravedad (ej: embargo de cuentas y remate de bienes, nulidad del despido, declaración de rebeldía, lanzamiento). Luego añade el análisis objetivo y sin anestesia de lo que pasa si el usuario no hace nada o no actúa a tiempo].

## 5. Próximos Pasos Recomendados
[Pasos accionables inmediatos: qué documentos extras debe reunir en OJV/PJUD con su ClaveÚnica, qué debe consultar urgentemente a un abogado o Corporación de Asistencia Judicial (CAJ), y cómo prepararse].

---
*Descargo de responsabilidad: Este análisis constituye una orientación informativa y técnica generada mediante Inteligencia Artificial adaptada a la legislación chilena. No constituye asesoría legal formal ni reemplaza el patrocinio y poder otorgado a un abogado habilitado para el ejercicio de la profesión en Chile (Ley 18.120).*
`;

const SYSTEM_INSTRUCTION_DOCUMENT_GENERATOR = `Eres un Abogado Litigante Senior en Chile con 20 años de experiencia en redacción de escritos judiciales para el Poder Judicial Chileno (PJUD) y la Oficina Judicial Virtual (OJV).

Tu tarea es redactar un documento legal chileno formal, listo para ser presentado ante el tribunal correspondiente. Debes generar el documento en formato Markdown estructurado, siguiendo EXACTAMENTE las formalidades procesales chilenas.

REGLAS OBLIGATORIAS:
1. FORMATO PJUD: Usa el formato estándar de escritos del Poder Judicial chileno: EN LO PRINCIPAL, PRIMER OTROSÍ, SEGUNDO OTROSÍ.
2. ENCABEZADO: Incluye S.J.L. (Señor Juez Letrado), identificación del tribunal (si se proporciona), RIT/ROL, y carátula.
3. FIRMA: Incluye espacio para firma del abogado patrocinante con nombre, RUT y cédula profesional.
4. FUNDAMENTACIÓN JURÍDICA: Cita artículos exactos del código correspondiente (CPC, Código del Trabajo, Ley 19.968, CPP, Ley 18.287, etc.).
5. CERO ALUCINACIONES: No inventes jurisprudencia ni números de rol. Si no tienes un dato, usa [COMPLETAR] como marcador.
6. PATROCINIO Y PODER: Incluye la cláusula estándar de patrocinio y poder según Ley 18.120.
7. DESCARGO: Al final del documento incluye la advertencia de que este es un modelo generado por IA que debe ser revisado y firmado por un abogado habilitado.

Responde ÚNICAMENTE con el documento legal redactado en markdown, sin comentarios adicionales ni introducciones.`;

// Helper: respuesta amigable cuando la cuota diaria de IA se agota en todos los modelos
// (o toda la cadena está saturada/indisponible). Responde 429 + CTA de WhatsApp.
function sendQuotaExhausted(res: any, err: any) {
  if (err instanceof GeminiQuotaExhaustedError || err instanceof GeminiUnavailableError) {
    const minutes = Math.max(5, Math.round(err.retryAfterSeconds / 60));
    res.status(429).json({
      error: `El servicio de IA está temporalmente saturado. Puede tardar hasta ~${minutes} min en restablecerse. Si tu caso es urgente, escríbenos por WhatsApp y te atendemos directamente: https://wa.me/56967658939`,
      retryAfter: err.retryAfterSeconds,
      whatsapp: "https://wa.me/56967658939",
    });
    return true;
  }
  return false;
}

// ========== DOCUMENT GENERATION ENDPOINT ==========
app.post("/api/generate-document", async (req, res) => {
  try {
    const { templateId, caseData } = req.body;

    if (!templateId || !caseData) {
      return res.status(400).json({ error: "templateId y caseData son requeridos" });
    }

    // Rate limiting
    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const rl = checkRateLimit(`generate-doc:${ip}`, ANALYZE_RATE_LIMIT);
    if (!rl.allowed) {
      return res.status(429).json({
        error: "Demasiadas solicitudes. Intenta en unos segundos.",
        retryAfter: Math.ceil(rl.resetMs / 1000),
      });
    }

    const clients = getGeminiClients();

    const templatePrompts: Record<string, string> = {
      contestacion_civil: `Redacta una CONTESTACIÓN DE DEMANDA CIVIL en formato PJUD. 
DATOS: Demandante: ${caseData.demandante || "[COMPLETAR]"}, Demandado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}.
Incluye: personería, opone excepciones dilatorias y perentorias, controvierte los hechos uno a uno, ofrece medios de prueba, y solicita rechazo total de la demanda con costas. Cita artículos del CPC.`,

      oposicion_ejecutivo: `Redacta una OPOSICIÓN DE EXCEPCIONES A LA EJECUCIÓN (Art. 464 CPC) en formato PJUD.
DATOS: Ejecutado: ${caseData.nombre || "[COMPLETAR]"}, Ejecutante: ${caseData.demandante || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}, Monto: ${caseData.materia || "[COMPLETAR]"}.
Opón al menos 3 excepciones del Art. 464 CPC (pago, prescripción, falsedad del título, etc.), ofrece prueba documental y solicita el rechazo de la ejecución con costas.`,

      demanda_despido: `Redacta una DEMANDA POR DESPIDO INJUSTIFICADO EN SEDE LABORAL en formato PJUD.
DATOS: Trabajador: ${caseData.nombre || "[COMPLETAR]"}, Empleador: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: relación circunstanciada de los hechos, fecha de inicio y término, causal invocada, razones por las que es injustificada, solicitud de indemnización sustitutiva del aviso previo, indemnización por años de servicio con recargo legal, feriado proporcional, y tutela laboral si corresponde. Cita Código del Trabajo Arts. 162, 163, 168, 485 y siguientes.`,

      demanda_alimentos: `Redacta una DEMANDA DE ALIMENTOS en formato PJUD para Juzgado de Familia.
DATOS: Demandante: ${caseData.nombre || "[COMPLETAR]"}, Demandado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: individualización de las partes, relación de los hijos, necesidades de los alimentarios, capacidad económica del alimentante, monto solicitado, solicitud de alimentos provisorios (Art. 54 Ley 19.968), y medidas de apremio en caso de incumplimiento. Cita Ley 19.968 y Ley 14.908.`,

      querella_penal: `Redacta una QUERELLA CRIMINAL en formato PJUD ante Juzgado de Garantía.
DATOS: Querellante: ${caseData.nombre || "[COMPLETAR]"}, Querellado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: individualización del querellante y querellado, relación circunstanciada de los hechos constitutivos de delito, calificación jurídica, participación, diligencias solicitadas al Ministerio Público, y solicitud de diligencias de investigación. Cita artículos del Código Penal y Código Procesal Penal.`,

      recurso_apelacion: `Redacta un RECURSO DE APELACIÓN en formato PJUD ante Corte de Apelaciones.
DATOS: Apelante: ${caseData.nombre || "[COMPLETAR]"}, Tribunal recurrido: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}.
Incluye: individualización de la resolución recurrida, fundamentos de hecho y de derecho del recurso, peticiones concretas, y solicitud de elevación del expediente. Cita CPC Arts. 186, 187, 189 y siguientes.`,
    };

    const prompt = templatePrompts[templateId] || templatePrompts.contestacion_civil;

    const response = await generateWithFallback(clients, {
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_DOCUMENT_GENERATOR,
        temperature: 0.15,
        maxOutputTokens: 8192,
      },
    });

    const document = response.text || "Error generando el documento. Por favor intenta nuevamente.";

    res.json({ document, templateId });
  } catch (err: any) {
    console.error("Error en /api/generate-document:", err);
    if (sendQuotaExhausted(res, err)) return;
    res.status(500).json({
      error: "Error generando el documento legal. Intenta nuevamente en unos minutos.",
    });
  }
});

// ========== DOCUMENT DOWNLOAD ENDPOINT ==========
app.post("/api/download-document", async (req, res) => {
  try {
    const { content, filename, format } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Contenido del documento requerido" });
    }

    const safeName = (filename || "documento-legal").replace(/[^a-zA-Z0-9_\-áéíóúñ]/g, "_");

    if (format === "txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.txt"`);
      return res.send(content);
    }

    // Default: Markdown download
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.md"`);
    return res.send(content);
  } catch (err: any) {
    console.error("Error en /api/download-document:", err);
    res.status(500).json({ error: "Error descargando documento" });
  }
});

// Route to analyze legal case / documents
app.post("/api/analyze", async (req, res) => {
  try {
    const { userStory, documentText, area, files, notificationDate } = req.body;

    if (!userStory && !documentText && (!files || files.length === 0)) {
      return res.status(400).json({
        error: "Debes ingresar al menos el relato de tu caso, el texto del documento o adjuntar una imagen/archivo legal.",
      });
    }

    // Rate limiting por IP (30/hora, configurable; debil en serverless, se migra a DB)
    const analyzeIp = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const analyzeRl = checkRateLimit(`analyze:${analyzeIp}`, GENERAL_API_RATE_LIMIT);
    if (!analyzeRl.allowed) {
      return res.status(429).json({
        error: "Demasiadas solicitudes. Intenta nuevamente en una hora.",
        retryAfter: Math.ceil(analyzeRl.resetMs / 1000),
      });
    }

    const clients = getGeminiClients();

    const parts: any[] = [];

    // Add user story and context
    let promptContent = `ÁREA/MATERIA DECLARADA: ${area || "No especificada / A determinar"}\n`;
    if (notificationDate) {
      promptContent += `FECHA DE NOTIFICACIÓN INDICADA POR EL USUARIO: ${notificationDate}\n`;
    }
    promptContent += `\nRELATO O PROBLEMA DEL USUARIO:\n${userStory || "Sin relato textual adicional."}\n\n`;

    if (documentText) {
      promptContent += `TEXTO O DOCUMENTO LEGAL TRANSCRITO/PEGADO:\n${documentText}\n\n`;
    }

    promptContent += `Por favor, como Abogado Litigante Senior en Chile, analiza meticulosamente esta información, determina las consecuencias procesales conforme al Derecho Chileno y genera el diagnóstico con la estructura obligatoria de 5 secciones.`;

    // Process attached base64 files (Word docs, PDFs, images, text)
    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (file.data) {
          const fileName = (file.name || "").toLowerCase();
          const mime = (file.mimeType || "").toLowerCase();
          const isWordDoc =
            mime.includes("word") ||
            mime.includes("officedocument") ||
            mime.includes("msword") ||
            fileName.endsWith(".docx") ||
            fileName.endsWith(".doc");

          if (isWordDoc) {
            try {
              const buffer = Buffer.from(file.data, "base64");
              const result = await mammoth.extractRawText({ buffer });
              const extractedText = result.value;
              if (extractedText && extractedText.trim()) {
                promptContent += `\n\n--- DOCUMENTO WORD ADJUNTADO: ${file.name || "documento.docx"} ---\n${extractedText.trim()}\n`;
              }
            } catch (docxErr) {
              console.error("Error extrayendo texto del archivo Word:", docxErr);
            }
          } else if (mime.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".rtf")) {
            try {
              const textContent = Buffer.from(file.data, "base64").toString("utf-8");
              if (textContent && textContent.trim()) {
                promptContent += `\n\n--- DOCUMENTO TEXTO ADJUNTADO: ${file.name || "archivo.txt"} ---\n${textContent.trim()}\n`;
              }
            } catch (txtErr) {
              console.error("Error leyendo texto adjunto:", txtErr);
            }
          } else {
            // PDF or Image native Gemini inlineData
            const safeMime = mime || (fileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
            parts.push({
              inlineData: {
                mimeType: safeMime,
                data: file.data,
              },
            });
          }
        }
      }
    }

    parts.push({ text: promptContent });

    // Caché: mismo relato + mismo documento = análisis cacheado (ahorra cuota diaria)
    const filesSig = files && Array.isArray(files)
      ? files.map((f: any) => `${f.name}:${(f.data || "").length}`).join(",")
      : "";
    const aKey = cacheKey([promptContent, filesSig]);
    const cachedAnalysis = getCached(aKey);
    if (cachedAnalysis) {
      console.log("[cache] /api/analyze hit de caché");
      return res.json({ analysis: cachedAnalysis, cached: true });
    }

    const response = await generateWithFallback(clients, {
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_LAWYER,
        temperature: 0.2, // Low temperature for high precision legal facts
      },
    });

    const analysis = response.text || "No se pudo generar el análisis legal. Por favor intenta nuevamente.";

    setCached(aKey, analysis);
    res.json({ analysis });
  } catch (err: any) {
    console.error("Error en /api/analyze:", err);
    if (sendQuotaExhausted(res, err)) return;
    res.status(500).json({
      error: "Error procesando el análisis legal. Intenta nuevamente en unos minutos.",
    });
  }
});

// ========== CAPA PREMIUM CON GROUNDING WEB OFICIAL (detrás de flag) ==========
// Fase 1: comentario corregido. Verificado en Vercel (2026-10-22):
// PREMIUM_GROUNDING_ENABLED=true está definida en Production, así que
// /api/premium-report ESTÁ ACTIVO en producción.
// No confundir con PREMIUM_GROUNDING (src/server/legalhelp-draft.ts), que
// controla si los BORRADORES exigen googleSearch y NO está definida (los
// borradores no requieren grounding): son dos variables distintas por diseño.
const PREMIUM_GROUNDING_ENABLED = process.env.PREMIUM_GROUNDING_ENABLED === "true";

// ── Fase 3 — helpers de paywall server-side ──────────────────────────────
// Verificación directa contra MP por external_reference (igual que /status).
async function verificarPagoMPAprobado(orderId: string): Promise<{ approved: boolean; monto: number | null; paymentId: string | null }> {
  if (!mpAccessToken) return { approved: false, monto: null, paymentId: null };
  try {
    const searchRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=1`,
      { headers: { Authorization: `Bearer ${mpAccessToken}` } }
    );
    if (!searchRes.ok) return { approved: false, monto: null, paymentId: null };
    const searchData = await searchRes.json();
    const item = searchData?.results?.[0];
    if (!item) return { approved: false, monto: null, paymentId: null };
    return { approved: item.status === "approved", monto: Number(item.transaction_amount ?? null), paymentId: String(item.id ?? "") };
  } catch {
    return { approved: false, monto: null, paymentId: null };
  }
}

// consumeUseSeguro: con DB, conteo atómico (usos < 3). Sin DATABASE_URL,
// degradación temporal DOCUMENTADA (DECISIONES.md F3.3): el MP sigue verificando
// la orden aprobada, pero no se puede contar el uso — se regresa cuando el
// dueño cree Vercel Postgres/Neon.
//
// requirePaidOrder: la orden debe estar aprobada en la DB. Si falta o está
// pendiente, consulta MP y "cura" la orden si un pago aprobado la cubre
// (defensa de monto incluida). Con usos >= 3 devuelve 402.
async function requirePaidOrder(orderId: string, precio: number): Promise<{ ok: boolean; usosRestantes: number }> {
  const order = await getOrderByOrderId(orderId);
  if (order?.status === "approved") {
    if (typeof order.usos === "number" && order.usos >= 3) return { ok: false, usosRestantes: 0 };
    return { ok: true, usosRestantes: order.usos != null ? Math.max(0, 3 - order.usos) : 3 };
  }
  const mpCheck = await verificarPagoMPAprobado(orderId);
  if (mpCheck.approved && (mpCheck.monto == null || mpCheck.monto >= precio)) {
    const healed = order || {
      orderId,
      preferenceId: `mp-healed-${orderId}`,
      status: "pending" as const,
      amount: precio,
      title: TITULO_DICTAMEN,
      createdAt: Date.now(),
    };
    await saveOrder({ ...healed, status: "approved", mpPaymentId: mpCheck.paymentId || healed.mpPaymentId, paidAt: healed.paidAt || Date.now() });
    return { ok: true, usosRestantes: 3 };
  }
  return { ok: false, usosRestantes: 0 };
}

async function consumeUseSeguro(orderId: string): Promise<{ ok: boolean; usos: number | null }> {
  if (!dbUrl()) {
    console.warn(`[premium] DATABASE_URL/POSTGRES_URL ausentes: uso de la orden ${orderId} NO contado (degradación temporal documentada en DECISIONES.md).`);
    return { ok: true, usos: null };
  }
  try {
    const r = await consumeUseAtomic(orderId);
    return { ok: r.ok, usos: r.usos };
  } catch (e: any) {
    // La DB pudo caer DESPUES de generar el dictamen: degradar igual que el
    // modo sin DATABASE_URL en vez de 500 tras haber pagado la generación.
    console.error(`[premium] consumeUseAtomic falló para ${orderId} (${String(e?.message || e).slice(0, 150)}): uso NO contado (degradación).`);
    return { ok: true, usos: null };
  }
}

const MATERIA_RULES: Array<{ materia: string; keywords: RegExp }> = [
  { materia: "Tránsito y multas (Ley 18.290)", keywords: /multa|tag|permiso de circulaci[oó]n|tr[aá]nsito|colisi[oó]n|18\.290|alcoholemia|licencia de conducir/i },
  { materia: "Laboral — despido, finiquito o autodespido", keywords: /despido|finiquito|autodespido|despido indirecto|trabajador|empleador|remuneraci[oó]n|cotizaciones|art[ií]culo 161|art[ií]culo 171|inspecci[oó]n del trabajo/i },
  { materia: "Familia — alimentos, custodia o medidas de protección", keywords: /aliment|pensi[oó]n alimenticia|custodia|visitas|familia|medida de protecci[oó]n|violencia intrafamiliar|divorcio/i },
  { materia: "Arriendo y desalojo (Ley 18.101)", keywords: /arriend|canon de arriendo|renta|desalojo|terminaci[oó]n de contrato|reconvenci[oó]n|ley 18\.101|predio urbano/i },
  { materia: "Juicio ejecutivo y títulos ejecutivos (CPC)", keywords: /pagar[eé]|cheque|factura|t[ií]tulo ejecutivo|mandamiento de ejecuci[oó]n|juicio ejecutivo|excepciones|art[ií]culo 464|c[oó]digo de procedimiento civil/i },
  { materia: "Cobranza, deudas y registros de morosidad", keywords: /deud|cobranza|dicom|equifax|moros|prescripci[oó]n|acreedor/i },
  { materia: "Civil — demanda ordinaria y notificaciones", keywords: /demanda|notificaci[oó]n|rebeld[ií]a|exhorto|juzgado civil|contestaci[oó]n de la demanda/i },
];

function detectMateria(texto: string): string {
  for (const rule of MATERIA_RULES) {
    if (rule.keywords.test(texto)) return rule.materia;
  }
  return "Derecho procesal civil chileno (materia no determinada con certeza)";
}

const PREMIUM_SYSTEM_INSTRUCTION = `
PROCEDIMIENTO OBLIGATORIO PREVIO (no negociable):
ANTES de redactar UNA sola línea, DEBES invocar la herramienta de búsqueda de Google Search MÍNIMO 5 VECES con consultas distintas (cada artículo citado, cada plazo, cada requisito formal). Si tu respuesta llega sin haber ejecutado búsquedas, se descarta automáticamente. Primero busca, después escribe.

Eres un auditor legal escéptico, especialista en Derecho Chileno, con más de 20 años de litigación en tribunales chilenos.
El usuario ha PAGADO. Recibirás el DICTAMEN JURÍDICO ya emitido por nuestro sistema para su caso. Tu tarea NO es reescribirlo ni repetirlo: es AÑADIR un complemento de verificación con búsqueda web que eleve la calidad del dictamen ya entregado.

Tienes acceso a Google Search. Realiza búsquedas y verifica el dictamen EXCLUSIVAMENTE contra fuentes OFICIALES chilenas:
bcn.cl (Biblioteca del Congreso Nacional / Leychile), pjud.cl (Poder Judicial), dt.gob.cl / dti.gob.cl (Dirección del Trabajo),
bcu.cl (Banco Central), mintrab.gob.cl, igm.cl, contraloria.cl, sernac.cl, diariooficial.interior.gob.cl,
y fallos o resoluciones oficiales publicadas por tribunales chilenos.

REGLAS ESTRICTAS:
1. Verifica los artículos, leyes y plazos CITADOS en el dictamen: confírmalos con la fuente oficial o marca "no verificado" si no aparecen en tus búsquedas. NO inventes números de artículos.
2. Aporta lo que el dictamen NO cubre: vicios de notificación, nulidades de todo género, plazos fatales fácilmente pasados por alto, requisitos formales estrictos y puntos ciegos que puedan hacer fracasar la estrategia.
3. PRIORIZA EXCLUSIVAMENTE fuentes oficiales. NO cites estudios de abogados, blogs ni sitios comerciales aunque aparezcan en los resultados.
4. Si un punto del dictamen contradice una fuente oficial que encontraste, dilo con claridad ("El dictamen indica X, pero la fuente oficial Y establece Z").
5. Prohibido saludar o usar fórmulas de cortesía. Entra directo al análisis.
6. No inventes fechas, montos ni hechos no entregados por el usuario.
7. El criterio jurisprudencial entregado en el contexto (fallos rectores CS) es un insumo de TRAZABILIDAD: úsalo para fundamentar la estrategia, pero antes de afirmar que un criterio sigue vigente, contrasta con tus búsquedas (puede haber fallos posteriores que lo superen). Marca "no verificado en línea" cuando no puedas confirmarlo.

ESTRUCTURA OBLIGATORIA (usa exactamente estos títulos, en Markdown):
## 1. Criterio Jurisprudencial Dominante y Estrategia Procesal
(Con el insumo de fallos rectores del contexto: criterio dominante de la materia, el fallo rector que lo fija, cómo se aplica al caso, la hoja de ruta procesal sugerida (pretensión, vía, prueba) y el riesgo principal si existiera criterio contrario. Si el insumo es insuficiente, no lo inventes: indica "criterio no determinado por el corpus, trasládese a la verificación web".)

## 2. Control de Nulidades y Puntos Ciegos
(Revisión de notificaciones, feriados, plazos fatales y exigencias procedimentales del caso; identifica requisitos formales estrictos y posibles vicios que el dictamen pudo omitir.)

## 3. Verificación de Artículos y Plazos Citados
(Para cada artículo/ley/plazo citado en el dictamen, indícalo con viñeta y su estado: "verificado en [fuente oficial]" o "no verificado en las fuentes consultadas". Máximo 8 viñetas, las más relevantes.)

## 4. Fuentes y Enlaces Oficiales Consultadas
(Listado con la URL EXACTA de cada fuente oficial que consultaste, en formato:
- Nombre del instrumento o página — URL completa (https://...)
Sin URLs inventadas: usa solo las URLs que realmente aparecieron en tus resultados de búsqueda.)
`.trim();

app.post("/api/premium-report", async (req, res) => {
  if (!PREMIUM_GROUNDING_ENABLED) {
    // Prod no debe exponer esta capa: mismo 404 que una ruta inexistente.
    return res.status(404).json({ error: "Not found" });
  }
  try {
    // ── Fase 3: paywall server-side. Nada de esta capa corre sin orden aprobada.
    // Cada generación (o acierto de caché) consume 1 de los 3 usos de la orden,
    // con UPDATE atómico en la DB. Degradación si no hay DATABASE_URL: se
    // re-verifica contra MP pero el conteo no es posible (documentado en
    // DECISIONES.md — temporal hasta crear Vercel Postgres/Neon).
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim() : "";
    if (!orderId) {
      return res.status(400).json({ error: "orderId es requerido (orden de pago)." });
    }
    // Rate limit: sin él, martillar el endpoint con orderIds inválidos provoca
    // llamadas salientes de verificación a MP por cada request (amplificación).
    const premiumIp = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const premiumRlCfg = process.env.PREMIUM_RATE_LIMIT_MAX
      ? { maxRequests: Number(process.env.PREMIUM_RATE_LIMIT_MAX), windowMs: 60_000 }
      : PAYMENT_RATE_LIMIT;
    const premiumRl = checkRateLimit(`premium:${premiumIp}`, premiumRlCfg);
    if (!premiumRl.allowed) {
      return res.status(429).json({ error: "Demasiadas solicitudes premium. Intenta en un minuto." });
    }
    const pago = await requirePaidOrder(orderId, PRECIO_DICTAMEN);
    if (!pago.ok) {
      return res.status(402).json({
        error: "Esta orden no fue aprobada o no tiene dictámenes premium disponibles (máximo 3 por orden).",
        orderId,
        usosRestantes: pago.usosRestantes,
      });
    }

    const { userStory, documentText, area, notificationDate, dictamenMarkdown } = req.body;

    if (!userStory && !documentText) {
      return res.status(400).json({ error: "Se requiere relato o documento del caso." });
    }

    const combinedText = [userStory, documentText].filter(Boolean).join("\n");
    const materia = detectMateria(combinedText);

    let promptContent = `MATERIA DETECTADA: ${materia}\n`;
    if (area) promptContent += `ÁREA DECLARADA: ${area}\n`;
    if (notificationDate) promptContent += `FECHA DE NOTIFICACIÓN: ${notificationDate}\n`;
    promptContent += `\nRELATO O DOCUMENTO DEL CASO:\n${combinedText.slice(0, 8000)}\n\n`;
    if (dictamenMarkdown && typeof dictamenMarkdown === "string") {
      promptContent += `DICTAMEN YA EMITIDO POR EL SISTEMA (verifícalo y complétalo, no lo repitas):\n"""${dictamenMarkdown.slice(0, 10000)}"""\n\n`;
    }
    promptContent += `Genera el COMPLEMENTO DE VERIFICACIÓN con búsqueda web del dictamen, con la estructura obligatoria de 4 secciones.`;

    // ── Extractor determinista (capa local, sin IA): plano de lectura, artefactos
    //    y acciones detectadas. Nunca arroja.
    let ext: ReturnType<typeof extraerChileno> | null = null;
    let planoExt = "";
    try {
      ext = extraerChileno(combinedText);
      planoExt = planoBlindajePrompt(ext);
      if (planoExt) promptContent += planoExt;
    } catch (extErr: any) {
      console.warn(`[premium][extractor] fallo (sigue sin plano): ${String(extErr?.message || extErr).slice(0, 150)}`);
    }

    // Verificacion determinista contra Ley Chile (BCN): textos oficiales de los
    // articulos citados en el dictamen/relato. Nunca arroja: fallo = bloque vacio.
    let citasBCN: Awaited<ReturnType<typeof verificarCitasBCN>> = { verificados: [], pendientes: [] };
    try {
      citasBCN = await verificarCitasBCN([combinedText, typeof dictamenMarkdown === "string" ? dictamenMarkdown : ""]);
      const bloqueBCN = bloquePromptBCN(citasBCN);
      if (bloqueBCN) promptContent += bloqueBCN;
    } catch (bcnErr: any) {
      console.warn(`[premium][bcn] verificacion BCN fallo (sigue solo con web): ${String(bcnErr?.message || bcnErr).slice(0, 150)}`);
    }

    // Recuperacion jurisprudencial (Open Legal Chile, vertical laboral): fallo rector
    // + fichas dogmaticas anadidas al prompt como guia institucional. Fallo = vacio.
    let juris: Awaited<ReturnType<typeof buscarJurisprudencia>> = [];
    let casos: Awaited<ReturnType<typeof buscarCasosJuris>> = [];
    try {
      // Multi-consulta determinista: cada seccion del caso (hechos/derecho/
      // petitorio/invocados) mas el relato generan su propia busqueda, y se
      // fusiona por score maximo. Documentos largos ya no dependen del slice.
      const consultas: ConsultaEtiquetada[] = [];
      if (userStory) consultas.push({ texto: String(userStory).slice(0, 2500), etiqueta: "relato" });
      if (ext) {
        if (ext.secciones.hechos) consultas.push({ texto: ext.secciones.hechos.slice(0, 2200), etiqueta: "hechos" });
        if (ext.secciones.derecho) consultas.push({ texto: ext.secciones.derecho.slice(0, 2500), etiqueta: "derecho" });
        if (ext.secciones.petitorio) consultas.push({ texto: ext.secciones.petitorio.slice(0, 1600), etiqueta: "petitorio" });
        const invocados = [ext.acciones.join(" "), ext.juzgado, ext.articulosInvocados.slice(0, 20).join(" "), ext.normasDetectadas.map((n) => n.nombre).join(" ")].filter(Boolean).join(" ");
        if (invocados) consultas.push({ texto: invocados, etiqueta: "invocados" });
      }
      if (!consultas.length) consultas.push({ texto: combinedText.slice(0, 4000), etiqueta: "documento" });
      else consultas.push({ texto: combinedText.slice(0, 3000), etiqueta: "documento" });

      // Fase 5: corpus completo por area (CORPUS_COMPLETO=true) - el slug sale
      // del area declarada por la UI; si falta, la sepia por keywords del texto.
      const areaDeclarada = String(area || "").trim().toLowerCase();
      const slugCorpus = esSlugCorpusArea(areaDeclarada)
        ? areaDeclarada
        : detectAreaFromContext(combinedText.slice(0, 4000));
      juris = await buscarJurisprudenciaMulti(consultas, 6, slugCorpus);
      const bloqueJuris = bloquePromptJuris(juris);
      if (bloqueJuris) promptContent += bloqueJuris;
      casos = await buscarCasosJurisMulti(consultas);
      const bloqueCasos = bloquePromptCasos(casos);
      if (bloqueCasos) promptContent += bloqueCasos;
    } catch (jurisErr: any) {
      console.warn(`[premium][juris] recuperacion fallo (sigue): ${String(jurisErr?.message || jurisErr).slice(0, 150)}`);
    }

    // Caché propia con sal premium-v9: no contamina la caché del dictamen normal.
    // (v7 = bloque determinista BCN + bloque jurisprudencial + bloque de casos análogos;
    //  el sal cambia porque la caché NO incluye la system instruction.)
    const pKey = cacheKey(["premium-v9", promptContent]);
    const cached = getCached(pKey);
    let cachedPayload: any = null;
    if (cached) {
      // Parsear ANTES de consumir: si el JSON cacheado está corrupto se
      // regenera sin cobrar uso (evita el doble cobro parse-fallido+regeneración).
      try { cachedPayload = JSON.parse(cached); } catch { cachedPayload = null; }
    }
    if (cachedPayload) {
      // Fase 3: el acierto de caché TAMBIÉN consume un uso (cada dictamen
      // entregado cuesta un slot, haya costado GPU o no).
      const consumed = await consumeUseSeguro(orderId);
      if (!consumed.ok) {
        return res.status(402).json({
          error: "Esta orden no tiene dictámenes premium disponibles (máximo 3 por orden).",
          orderId,
          usosRestantes: 0,
        });
      }
      console.log("[cache] /api/premium-report hit de caché");
      return res.json({ ...cachedPayload, materia, cached: true, usosRestantes: consumed.usos == null ? null : Math.max(0, 3 - consumed.usos) });
    }

    const clients = getGeminiClients();
    const basePayload = {
      contents: { parts: [{ text: promptContent }] },
    };

    let response: any;
    let grounded = false;
    try {
      response = await generateWithFallback(
        clients,
        {
          ...basePayload,
          config: {
            systemInstruction: PREMIUM_SYSTEM_INSTRUCTION,
            temperature: 0.15,
            maxOutputTokens: 8192,
            tools: [{ googleSearch: {} }],
          },
        },
        // El premium exige búsqueda real: nada de modelos lite ni respuestas sin grounding.
        { requireGrounding: true, skipLite: true }
      );
      grounded = true;
    } catch (toolErr: any) {
      // Si el tool de búsqueda es rechazado (p.ej. billing no habilitado),
      // retry SIN tool: la instrucción anti-inventario se mantiene igual.
      const msg = String(toolErr?.message || toolErr);
      console.warn(`[premium] grounding googleSearch falló (${msg.slice(0, 200)}), retry sin tool.`);
      response = await generateWithFallback(
        clients,
        {
          ...basePayload,
          config: {
            systemInstruction: PREMIUM_SYSTEM_INSTRUCTION,
            temperature: 0.15,
            maxOutputTokens: 8192,
          },
        },
        { skipLite: true }
      );
    }

    let report = response.text || "";
    if (!report.trim()) {
      return res.status(502).json({ error: "El modelo no devolvió contenido para la auditoría premium." });
    }

    // Extraer fuentes oficiales reales del grounding de Gemini.
    // Nota: `uri` puede ser un redirect de Vertex (vertexaisearch...); `title`
    // suele ser el dominio real (p.ej. "leychile.cl", "bcn.cl").
    const sources: Array<{ title: string; uri: string; domain: string }> = [];
    try {
      const cand0 = (response as any)?.candidates?.[0];
      const chunks = cand0?.groundingMetadata?.groundingChunks || [];
      if (chunks.length === 0) {
        // DEBUG temporal: por qué vino sin chunks
        console.warn(
          "[premium][debug] 0 groundingChunks | candidates=",
          (response as any)?.candidates?.length,
          "| cand0 keys=",
          Object.keys(cand0 || {}).join(","),
          "| gm keys=",
          Object.keys(cand0?.groundingMetadata || {}).join(","),
          "| gm=",
          JSON.stringify(cand0?.groundingMetadata || {}).slice(0, 400)
        );
      }
      for (const chunk of chunks) {
        if (chunk?.web?.uri) {
          const title = chunk.web.title || "";
          const domain = chunk.web.domain || title || "";
          sources.push({ title: title || chunk.web.uri, uri: chunk.web.uri, domain });
        }
      }
    } catch {
      /* sin groundingMetadata */
    }

    // "grounded" real = la búsqueda efectivamente se ejecutó y devolvió fuentes.
    grounded = sources.length > 0;

    // Segunda pasada BCN sobre el INFORME FINAL: cualquier articulo que el modelo
    // haya citado (aunque no estuviera en el dictamen) se contrasta contra el texto
    // oficial. Las normas ya consultadas salen de cache (coste marginal = 0).
    try {
      const bcnInforme = await verificarCitasBCN([report]);
      const vistos = new Set(citasBCN.verificados.map((a) => `${a.keyNorma}:${a.articulo}`));
      for (const a of bcnInforme.verificados) {
        const k = `${a.keyNorma}:${a.articulo}`;
        if (!vistos.has(k)) { citasBCN.verificados.push(a); vistos.add(k); }
      }
      const pendVistos = new Set(citasBCN.pendientes.map((p) => `${p.keyNorma}:${(p.articulosPedidos || []).join(",")}`));
      for (const p of bcnInforme.pendientes) {
        const k = `${p.keyNorma}:${(p.articulosPedidos || []).join(",")}`;
        if (!pendVistos.has(k)) { citasBCN.pendientes.push(p); pendVistos.add(k); }
      }
    } catch (bcn2Err: any) {
      console.warn(`[premium][bcn-final] verificacion del informe fallo (sigue): ${String(bcn2Err?.message || bcn2Err).slice(0, 150)}`);
    }

    // Resumen BCN ligero para la UI (sin textos completos; esos van directo al prompt)
    const bcn = {
      citados: citasBCN.verificados.map((a) => ({
        nombreNorma: a.nombreNorma,
        articulo: a.articulo,
        vigente: a.vigente,
        fechaVersion: a.fechaVersion || "",
        url: a.url,
      })),
      pendientes: citasBCN.pendientes.map((p) => ({ nombreNorma: p.nombreNorma, motivo: p.motivo })),
    };
    const jurisResumen = resumenJuris(juris);
    const casosResumen = resumenCasos(casos);

    // ── Validador post-salida (QA determinista, sin IA): contrasta roles, arts
    //    y montos del informe final contra corpus + BCN. Marca lo no verificado
    //    como apendice del propio informe. Nunca arroja.
    let validacion: ReturnType<typeof validarInforme> | null = null;
    try {
      const rolesCorpus = [
        ...jurisResumen.map((j) => j.rolFalloRector),
        ...casosResumen.map((c) => c.rol),
        ...casos.filter((c) => c.tipo === "fallo_rector").map((c) => c.rol),
      ].filter(Boolean);
      const valid = validarInforme(report, {
        rolesCorpus,
        artsCubiertos: citasBCN.verificados.map((a) => a.articulo),
        artsPendientes: citasBCN.pendientes.flatMap((p) => p.articulosPedidos ?? []),
        montosDoc: ext?.montos || [],
        textoDoc: combinedText,
      });
      validacion = valid;
      const nota = notaBlindajeReporte(valid);
      if (nota) report = report + nota;
    } catch (valErr: any) {
      console.warn(`[premium][validador] fallo (informe sin nota): ${String(valErr?.message || valErr).slice(0, 150)}`);
    }

    const result = {
      report, materia, sources, grounded, bcn, jurisprudencia: jurisResumen, casos: casosResumen,
      validacion: validacion ? {
        rolesEnCorpus: validacion.rolesEnCorpus,
        rolesNoEnCorpus: validacion.rolesNoEnCorpus,
        artsCubiertos: validacion.artsCubiertos,
        artsSinCobertura: validacion.artsSinCobertura,
        montosInforme: validacion.montosInforme.length,
        montosNoCorroborados: validacion.montosNoCorroborados,
      } : null,
      documentos: ext ? { acciones: ext.acciones, juzgado: ext.juzgado, articulosInvocados: ext.articulosInvocados.slice(0, 20) } : null,
    };
    // Fase 3: el uso se descuenta SOLO cuando el dictamen ya está listo
    // (generación exitosa). Si el ASSIGN atómico no puede ejecutarse (usos
    // agotados), el informe se retrocede y no se envía: no hay dictamen gratis.
    const consumed = await consumeUseSeguro(orderId);
    if (!consumed.ok) {
      console.warn(`[premium] orden ${orderId}: asignación de uso rechazada (usos agotados). Informe listo NO se entrega.`);
      return res.status(402).json({
        error: "Esta orden no tiene dictámenes premium disponibles (máximo 3 por orden).",
        orderId,
        usosRestantes: 0,
      });
    }
    setCached(pKey, JSON.stringify(result));
    res.json({ ...result, usosRestantes: consumed.usos == null ? null : Math.max(0, 3 - consumed.usos) });
  } catch (err: any) {
    console.error("Error en /api/premium-report:", err);
    if (sendQuotaExhausted(res, err)) return;
    res.status(500).json({ error: "Error generando la auditoría premium. Intenta nuevamente en unos minutos." });
  }
});

// LegalHelp IA — Motor de Redacción Procesal
app.post("/api/legalhelp/draft", async (req, res) => {
  try {
    const input = req.body as import("./src/types").DraftInput;
    if (!input?.hechos?.trim() || !input?.pretensiones?.length) {
      return res.status(400).json({ error: "Se requieren hechos y al menos una pretensión." });
    }
    // Rate limiting por IP (30/hora; debil en serverless, se migra a DB)
    const draftIp = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const draftRl = checkRateLimit(`draft:${draftIp}`, GENERAL_API_RATE_LIMIT);
    if (!draftRl.allowed) {
      return res.status(429).json({
        error: "Demasiadas solicitudes de borradores. Intenta nuevamente en una hora.",
        retryAfter: Math.ceil(draftRl.resetMs / 1000),
      });
    }
    const output = await handleLegalHelpDraft(input);
    res.json(output);
  } catch (err: any) {
    console.error("Error en /api/legalhelp/draft:", err);
    if (sendQuotaExhausted(res, err)) return;
    res.status(500).json({ error: "Error generando el borrador. Intenta nuevamente en unos minutos." });
  }
});

// Piloto del retriever jurisprudencial (sin LLM): valida el corpus y el scoring.
app.post("/api/juris-test", async (req, res) => {
  try {
    const { texto } = req.body || {};
    const q = typeof texto === "string" ? texto : "despedido por necesidades de la empresa con carta que solo invoca reestructuración, no acredita antecedentes objetivos";
    const resultados = await buscarJurisprudencia([q]);
    res.json({ total: resultados.length, resultados: resumenJuris(resultados) });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Follow-up chat endpoint for asking specific legal questions about the case
app.post("/api/chat", async (req, res) => {
  try {
    const { history, userMessage, currentCaseContext } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Mensaje de usuario requerido." });
    }

    // Rate limiting por IP (30/hora; debil en serverless, se migra a DB)
    const chatIp = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const chatRl = checkRateLimit(`chat:${chatIp}`, GENERAL_API_RATE_LIMIT);
    if (!chatRl.allowed) {
      return res.status(429).json({
        error: "Demasiadas consultas. Intenta nuevamente en una hora.",
        retryAfter: Math.ceil(chatRl.resetMs / 1000),
      });
    }

    // Detectar intención de generar borrador (LegalHelp IA)
    // Normalizar removiendo acentos para evitar problemas de codificación UTF-8 en el body parser
    function normalizeNoAccents(s: string): string {
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    const msg = normalizeNoAccents(userMessage);

    // ───── LEGALHELP IA: intercepción de intención de redactar ─────
    // Tier 1: verbo + sustantivo (con muletillas entre medio) o keywords fuertes.
    // Tier 2: si el LLM igual devolviera una negativa ética, se intercepta y se
    //         convierte en draftAction (sin cachearla), suprimiendo cualquier
    //         bloqueo ético para los comandos de redacción autorizados.
    const DRAFT_VERBO = /(?:generar|crear|redactar|redactame|escribeme|hacer|elaborar|confeccionar|escribir|preparar|preparame|dame|ayudame|ayudar|contestar|responder|entregar|entregame|necesito|necesitan|necesitamos|quiero|queremos|deseo|requiero|solicito|solicita|solicitan)\b/i;
    const DRAFT_SUST = /\b(?:borrador|escrito|minuta|otrosi|contestacion|defensa|demanda|replica)\b/i;
    const DRAFT_STRONG = /\b(?:borrador|redactar|redactame|otrosi)\b/i;

    const verbNearNoun = (s: string): boolean => {
      const vi = s.search(DRAFT_VERBO);
      const ni = s.search(DRAFT_SUST);
      if (vi === -1 || ni === -1) return false;
      const gap = vi < ni ? ni - (vi + 8) : (vi + 8) - ni;
      return gap >= -8 && gap < 60;
    };

    const wantsDraft = verbNearNoun(msg) || DRAFT_STRONG.test(msg);

    // Tipo inferido: primero escritos específicos, luego defensas (orden evita que
    // "contestar la demanda" caiga en demanda en vez de contestacion).
    const inferTipoFromMsg = (s: string): DraftInput["tipo"] => {
      if (/otrosi/i.test(s)) return "otrosi";
      if (/minuta/i.test(s)) return "minuta";
      if (/contrato/i.test(s)) return "contrato";
      if (/correo|carta/i.test(s)) return "correo";
      if (/contestacion|defensa|contestar|responder|replica/i.test(s)) return "contestacion";
      if (/demanda/i.test(s)) return "demanda";
      return "contestacion";
    };

    // Builder reutilizable (Tier 1 y Tier 2): mapea el diagnóstico completo a DraftInput
    const buildDraftSuggestion = (rawMsg: string, rawCtx: string) => {
      const suggestedTipo = inferTipoFromMsg(normalizeNoAccents(rawMsg));
      const ctx = typeof rawCtx === "string" ? rawCtx : "";
      const limpiarMd = (s: string): string =>
        s.replace(/^\s*#{1,6}\s*/, "").replace(/\*\*/g, "").replace(/[`_]/g, "").trim();

      // HECHOS: preferir el RELATO INICIAL (narrativa del usuario); fallback: sección Resumen del diagnóstico
      let hechos = "";
      if (ctx.includes("RELATO INICIAL:\n")) {
        hechos = ctx.split("RELATO INICIAL:\n")[1]?.split("\n\nDIAGN")[0]?.slice(0, 4000) || "";
      }
      if (!hechos) {
        const mRes = ctx.match(/Resumen[\s\S]{0,2000}?(?=\n#{1,4}\s|\n##\s)/i);
        if (mRes) hechos = mRes[0].slice(0, 4000);
      }

      // ROL: formatos RIT/ROL/RUC presentes en el análisis (ej: "RIT O-100-2026", "Rol N° 12345-2024", "RUC 1234-5")
      let rol = "";
      const reRolEtiqueta = /\b(?:RIT|ROL|R\.?O\.?L\.?)\b[:\s°ºN.]*([A-Za-z]-?\d{1,7}\s*[-–]\s*\d{2,4}|\d{1,7}\s*[-–]\s*\d{2,4})\b/i;
      const reRolSueltas = /\b([OCR]-\d{1,7}-\d{2,4})\b/;
      const mRol1 = ctx.match(reRolEtiqueta);
      if (mRol1) rol = mRol1[1].replace(/\s*/g, "");
      else {
        const mRol2 = ctx.match(reRolSueltas);
        if (mRol2) rol = mRol2[1];
      }
      if (!rol) {
        const mRuc = ctx.match(/\bRUC\b[:\s]*([\d]{5,12}[-–]\d)/i);
        if (mRuc) rol = `RUC ${mRuc[1]}`;
      }

      // TRIBUNAL: regex amplia (incluye 1er/2º Juzgado y comuna) vs extractor determinista; gana la variante más completa
      let tribunal = "";
      if (ctx) {
        const mJuz = ctx.match(
          /\b(?:[1-9](?:[ºo°]|\s*er|\s*ro)?\s+)?(?:Juzgado|Tribunal)\s+(?:de\s+)?(?:Letras(?:\s+del\s+Trabajo)?|de\s+Familia|de\s+Letras\s+y\s+Garant[íi]a|de\s+Garant[íi]a|de\s+Polic[íi]a\s+Local|de\s+Cobranza\s+Laboral\s+y\s+Previsional|Civil\s+de\s+[^,\n.)]{3,40}|de\s+Comercio|Juicio\s+Oral\s+(?:penal|en\s+lo\s+penal)|Laboral)(?:\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ][^,\n.)]{2,40})?/i
        );
        const regexHit = mJuz ? mJuz[0].replace(/\s+/g, " ").trim() : "";
        let extractorHit = "";
        try {
          extractorHit = extraerChileno(ctx).juzgado;
        } catch {
          extractorHit = "";
        }
        if (regexHit.length >= extractorHit.length) tribunal = regexHit;
        else tribunal = extractorHit;
      }

      // PRETENSIONES: bullets de estrategia/defensa del diagnóstico propio (coherencia 100% con el análisis)
      let pretensiones: string[] = [];
      if (ctx) {
        const lineas = ctx.split("\n");
        const reHeader = /(estrategia|defensa|riesgo|recomendaci|pr[oó]ximos?\s+pasos|acci[oó]n(?:es)?|argumentos)/i;
        const recolectando: string[] = [];
        let enSeccion = false;
        for (const linea of lineas) {
          const esHeader = /^\s*#{1,6}\s+/.test(linea) || /^[A-ZÁÉÍÓÚÑ0-9 .:]{4,40}:?\s*$/.test(linea);
          const normLinea = normalizeNoAccents(linea);
          if (esHeader && reHeader.test(normLinea)) {
            enSeccion = true;
            continue;
          }
          if (esHeader && enSeccion) enSeccion = false; // otro encabezado corta la sección
          if (enSeccion) {
            const mBullet = linea.match(/^\s*(?:[-*•]|\d+[.)])\s+(.{10,220})$/);
            if (mBullet) recolectando.push(limpiarMd(mBullet[1]));
          }
        }
        pretensiones = recolectando.filter((t, i) => t.length >= 15 && recolectando.findIndex((x) => x === t) === i).slice(0, 6);
      }

      // Fallback 1: acciones detectadas por el extractor determinista → tesis de defensa
      if (!pretensiones.length) {
        try {
          const acciones = extraerChileno(ctx).acciones;
          if (acciones.length) {
            pretensiones = acciones.map((a) =>
              suggestedTipo === "contestacion"
                ? `Enjuiciar/questionar la tesis de ${a} presentada por la contraparte`
                : `Reclamar: ${a}`
            );
          }
        } catch {
          /* extractor nunca arroja, probabilidad baja */
        }
      }

      // Fallback 2: genéricos actuales
      if (!pretensiones.length) {
        pretensiones =
          suggestedTipo === "contestacion"
            ? ["Rechazar la demanda en todas sus partes", "Excepción de caducidad si procede", "Costas"]
            : ["Declarar...", "Condenar...", "Costas"];
      }

      const area = detectAreaFromContext(ctx || "");

      return {
        draftAction: true as const,
        suggestedTipo,
        suggestedInput: {
          tipo: suggestedTipo,
          hechos: hechos || "Ver relato en diagnóstico adjunto",
          area,
          pretensiones,
          ...(rol ? { rol } : {}),
          ...(tribunal ? { tribunal } : {}),
        },
        reply: `✅ Detecté que quieres redactar un escrito. Preparé el formulario con los datos del diagnóstico (hechos, rol, tribunal y defensas detectadas). Completa lo que falte o añade antecedentes antes de generar.`,
        cached: false as const,
      };
    };

    if (wantsDraft) {
      // NO cachear respuestas de draftAction; la intención intercepta todo flujo conversacional
      console.log(`[draft] Tier 1: intención detectada ("${userMessage.slice(0, 60)}")`);
      return res.json(buildDraftSuggestion(userMessage, currentCaseContext));
    }

    // ───── Tier 2: intercepción de negativa ética ─────
    const DRAFT_HINT_RE = /\b(?:borrador|redactar|redactame|contestacion|defensa|escrito|minuta|otrosi|replica|demanda)\b/i;
    const REFUSAL_RE =
      /(?:no\s+(?:puede?s?|me)\s+(?:generar|redactar|hacer|elaborar|ayudar|asistir|crear|entregar|preparar)|s[oó]lo?\s+un\s+abogado|debes?\s+(?:consultar|acudir)\s+[^\n]{0,60}\s*abogado|consultar?\s+(?:urgentemente\s+)?a\s+un\s+abogado|reitero[^\n]{0,60}abogado)/i;

    // Caché: misma pregunta + mismo contexto = respuesta cacheada (ahorra cuota diaria).
    // Pero si la caché contiene una negativa ética y hay intención de draft → se ignora.
    const cKey = cacheKey([
      userMessage,
      typeof currentCaseContext === "string" ? currentCaseContext.slice(0, 2000) : "",
    ]);
    const cached = getCached(cKey);
    if (cached && REFUSAL_RE.test(cached) && DRAFT_HINT_RE.test(msg)) {
      console.log("[draft] Tier 2a: caché con negativa ética → convertida a draftAction (sin LLM)");
      return res.json(buildDraftSuggestion(userMessage, currentCaseContext));
    }
    if (cached) {
      console.log("[cache] /api/chat hit de caché");
      return res.json({ reply: cached, cached: true });
    }

    const clients = getGeminiClients();

    const contents: any[] = [];

    // Filter and sanitize past history to ensure strict alternating roles
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (!msg.content || typeof msg.content !== "string") continue;
        const role = msg.role === "user" ? "user" : "model";
        // Do not add if it repeats the exact same role as the previous element
        if (contents.length === 0 || contents[contents.length - 1].role !== role) {
          contents.push({ role, parts: [{ text: msg.content }] });
        }
      }
    }

    // Ensure history does not end with a 'user' turn before pushing the current user prompt
    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      contents.pop();
    }

    let fullPrompt = "";
    if (currentCaseContext) {
      fullPrompt += `[CONTEXTO DEL CASO Y DIAGNÓSTICO EN OBSERVACIÓN]:\n${currentCaseContext}\n\n`;
    }
    fullPrompt += `[CONSULTA DEL CLIENTE SOBRE SU CASO]:\n${userMessage}`;

    contents.push({ role: "user", parts: [{ text: fullPrompt }] });

    const response = await generateWithFallback(clients, {
      contents,
      config: {
        systemInstruction:
          SYSTEM_INSTRUCTION_LAWYER +
          "\n\nInstrucción adicional para el chat de consultas: El cliente está haciendo una pregunta específica de orientación legal sobre su caso o sobre el diagnóstico preliminar. Responde de forma clara, precisa, tranquilizadora y fundada en el derecho chileno.",
        temperature: 0.3,
      },
    });

    const reply =
      response.text ||
      "Estimado cliente, conforme a la legislación procesal chilena y los antecedentes aportados, le sugiero verificar la fecha exacta de notificación y revisar las actuaciones en la Oficina Judicial Virtual (OJV).";

    // Tier 2b: si el LLM devolvió una negativa ética y hay intención de redactar,
    // se intercepta y se convierte en draftAction (se suprime el bloqueo ético).
    if (REFUSAL_RE.test(reply) && DRAFT_HINT_RE.test(msg)) {
      console.log("[draft] Tier 2b: negativa ética del LLM interceptada → convertida a draftAction");
      return res.json(buildDraftSuggestion(userMessage, currentCaseContext));
    }

    // No almacenar negativas éticas en caché (evita envenenar consultas futuras)
    if (!REFUSAL_RE.test(reply)) setCached(cKey, reply);
    res.json({ reply });
  } catch (err: any) {
    console.error("Error en /api/chat:", err);
    if (sendQuotaExhausted(res, err)) return;
    res.status(500).json({
      error: "Error procesando la consulta. Intenta nuevamente en unos minutos.",
    });
  }
});

// MercadoPago Integration Endpoints (reference: legalhelp-chile)
// (precio y título fijados arriba, en las constantes de Fase 0)

app.post("/api/payment/create", async (req, res) => {
  try {
    const { name, rut, email } = req.body;
    const orderId = crypto.randomUUID();

    // Determine correct public base URL from request or environment
    const host = req.get("host") || "localhost:3000";
    const proto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
    const scheme = (proto === "https" || !host.includes("localhost")) ? "https" : "http";

    let baseUrl = process.env.APP_URL;
    if (!baseUrl || baseUrl.includes("localhost")) {
      const origin = req.get("origin") || req.get("referer");
      if (origin && !origin.includes("localhost")) {
        baseUrl = origin.replace(/\/$/, "");
      } else {
        baseUrl = `${scheme}://${host}`;
      }
    }

    const payerEmail = typeof email === "string" && email.includes("@") ? email : undefined;

    if (mp && isMpConfigured) {
      try {
        const preferenceBody: any = {
          external_reference: orderId,
          items: [
            {
              id: "dictamen-completo",
              title: `${TITULO_DICTAMEN} - LegalHelp Chile`,
              quantity: 1,
              unit_price: PRECIO_DICTAMEN,
              currency_id: "CLP",
            },
          ],
          ...(payerEmail ? { payer: { email: payerEmail } } : {}),
          back_urls: {
            success: `${baseUrl}/?payment=success&orderId=${orderId}`,
            failure: `${baseUrl}/?payment=failure&orderId=${orderId}`,
            pending: `${baseUrl}/?payment=pending&orderId=${orderId}`,
          },
          binary_mode: true,
          auto_return: "approved",
          statement_descriptor: "LegalHelp",
          payment_methods: {
            installments: 1,
            default_installments: 1,
          },
        };

        // MercadoPago requires notification_url to be HTTPS
        if (baseUrl.startsWith("https://")) {
          preferenceBody.notification_url = `${baseUrl}/api/payment/webhook`;
        }

        console.log("Creating MP Preference with body:", JSON.stringify(preferenceBody, null, 2));
        const preference = await new Preference(mp).create({ body: preferenceBody });

        await saveOrder({
          orderId,
          preferenceId: preference.id!,
          status: "pending",
          amount: PRECIO_DICTAMEN,
          title: TITULO_DICTAMEN,
          payerEmail,
          createdAt: Date.now(),
        });

        const checkoutUrl = isSandbox
          ? (preference.sandbox_init_point || preference.init_point)
          : preference.init_point;

        return res.json({
          ok: true,
          orderId,
          preferenceId: preference.id,
          checkoutUrl,
          isRealMP: true,
        });
      } catch (mpErr: any) {
        console.error("Error al crear preferencia en MercadoPago SDK:", mpErr?.message || mpErr);
        if (mpErr?.cause) console.error("mpErr cause:", JSON.stringify(mpErr.cause));
        if (mpErr?.status) console.error("mpErr status:", mpErr.status);
        return res.status(500).json({
          ok: false,
          error: "Error creando preferencia en MercadoPago",
          detail: mpErr?.message || String(mpErr),
          cause: mpErr?.cause || null,
        });
      }
    }

    // Fallback order saving if MP token is not provided in environment or during test mode
    await saveOrder({
      orderId,
      preferenceId: `pref-${orderId}`,
      status: "pending",
      amount: PRECIO_DICTAMEN,
      title: TITULO_DICTAMEN,
      payerEmail,
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      orderId,
      preferenceId: `pref-${orderId}`,
      checkoutUrl: null,
      isRealMP: false,
      message: "MercadoPago simulado listo para confirmación previa a producción.",
    });

  } catch (err: any) {
    console.error("Error en /api/payment/create:", err);
    res.status(500).json({ error: "Error iniciando pago con MercadoPago: " + (err.message || String(err)) });
  }
});

// GET /api/payment/status?orderId=xxx
app.get("/api/payment/status", async (req, res) => {
  const orderId = req.query.orderId as string;
  if (!orderId) {
    return res.status(400).json({ error: "orderId es requerido" });
  }

  const order = await getOrderByOrderId(orderId);
  if (!order) {
    return res.status(404).json({ error: "Orden no encontrada" });
  }

  if (order.status !== "pending") {
    return res.json({
      orderId: order.orderId,
      status: order.status,
      paidAt: order.paidAt || null,
    });
  }

  // Fallback direct check to Mercado Pago API using external_reference
  if (isMpConfigured && mpAccessToken) {
    try {
      const searchRes = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc&limit=1`,
        {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData.results;
        if (results && results.length > 0) {
          const paymentItem = results[0];
          // Defensa de monto: un pago aprobado por menos que el precio de la
          // orden NO desbloquea (ajusta su precision al costo real del dictamen).
          if (Number(paymentItem.transaction_amount) < order.amount) {
            console.warn(`/api/payment/status: pago ${paymentItem.id} por ${paymentItem.transaction_amount} < orden ${orderId} por ${order.amount} -> failed`);
            await updateOrder(orderId, { status: "failed", mpPaymentId: String(paymentItem.id) });
            return res.json({ orderId, status: "failed" });
          }
          if (paymentItem.status === "approved") {
            await updateOrder(orderId, {
              status: "approved",
              mpPaymentId: String(paymentItem.id),
              paidAt: Date.now(),
            });
            return res.json({ orderId, status: "approved", paidAt: Date.now() });
          } else if (paymentItem.status === "rejected") {
            await updateOrder(orderId, { status: "failed" });
            return res.json({ orderId, status: "failed" });
          }
        }
      }
    } catch (e) {
      console.error("Error verificando pago en MP API:", e);
    }
  }

  return res.json({
    orderId: order.orderId,
    status: order.status,
    paidAt: order.paidAt || null,
  });
});

// Webhook endpoint for MercadoPago IPN notifications
app.post("/api/payment/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type || req.query.topic;
    const rawId = body.data?.id || req.query.id;

    if (type !== "payment" || !rawId) {
      return res.json({ ok: true });
    }

    const paymentId = String(rawId);
    if (mp && isMpConfigured) {
      const paymentData = await new Payment(mp).get({ id: paymentId });
      const status = paymentData.status;
      const externalRef = paymentData.external_reference;

      if (externalRef) {
        // Defensa de monto: no marcar aprobada una orden pagada por menos que su precio.
        const pagoMonto = Number(paymentData.transaction_amount);
        const ordenExistente = await getOrderByOrderId(externalRef);
        if (status === "approved" && ordenExistente && pagoMonto && pagoMonto < ordenExistente.amount) {
          console.warn(`webhook: pago ${paymentId} por ${pagoMonto} < orden ${externalRef} por ${ordenExistente.amount} -> failed`);
          await updateOrder(externalRef, { status: "failed", mpPaymentId: paymentId });
          return res.json({ ok: true });
        }
        if (status === "approved") {
          await updateOrder(externalRef, {
            status: "approved",
            mpPaymentId: paymentId,
            paidAt: Date.now(),
          });
        } else if (status === "rejected" || status === "cancelled") {
          await updateOrder(externalRef, { status: "failed" });
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error en webhook de MercadoPago:", err);
    return res.json({ ok: true });
  }
});

// ========== SEO LANDING PAGES (Long-Tail) ==========
// Renderizador markdown ligero para contenido SEO (negritas, headings, links, listas, citas, hr).
// Evita mostrar **texto** y [links](/url) como texto crudo en las páginas SSR.
function mdLite(src: string): string {
  if (!src) return "";
  let s = String(src);

  // Escape básico de HTML para evitar inyección (excepto lo que nosotros generamos después)
  s = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Links: [texto](/url) o [texto](https://...) o [texto](#ancla) -> <a href>
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    // Solo permitir rutas relativas, https o anclas
    if (url.startsWith("/") || url.startsWith("https://") || url.startsWith("#")) {
      return `<a href="${url}">${text}</a>`;
    }
    return text;
  });

  // Negritas: **texto** -> <strong>
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Cursiva: *texto* -> <em> (sin interferir con ** ya resuelto)
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");

  // Blockquotes: > texto -> <blockquote>
  s = s.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rule: --- o *** en línea propia
  s = s.replace(/^---+\s*$/gm, "<hr />");
  s = s.replace(/^\*\*\*+\s*$/gm, "<hr />");

  // Headings: ### y ## (con id para anclas TOC)
  s = s.replace(/^###\s+(.+)$/gm, (_m, text) => {
    const id = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `<h3 id="${id}">${text}</h3>`;
  });
  s = s.replace(/^##\s+(.+)$/gm, (_m, text) => {
    const id = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `<h2 id="${id}">${text}</h2>`;
  });
  s = s.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");

  // Listas con guiones o viñetas: - item / * item -> <ul><li>
  // Agrupar líneas consecutivas en un solo <ul>
  s = s.replace(/((?:^[-*]\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map((line) => {
      const m = line.match(/^[-*]\s+(.+)$/);
      return m ? `<li>${m[1]}</li>` : "";
    }).filter(Boolean).join("");
    return items ? `<ul>${items}</ul>` : block;
  });

  // Listas numeradas: 1. item -> <ol><li>
  s = s.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map((line) => {
      const m = line.match(/^\d+\.\s+(.+)$/);
      return m ? `<li>${m[1]}</li>` : "";
    }).filter(Boolean).join("");
    return items ? `<ol>${items}</ol>` : block;
  });

  // Unir párrafos: doble salto de línea -> </p><p>, y envolver en <p>
  s = s.replace(/\n{2,}/g, "</p><p>");
  s = s.replace(/\n/g, " ");
  s = `<p>${s}</p>`;

  // Limpiar <p> vacíos y <p> que envuelvan bloques block-level
  s = s.replace(/<p>\s*(<(?:h2|h3|ul|ol|hr|blockquote)[^>]*>)/g, "$1");
  s = s.replace(/(<\/(?:h2|h3|ul|ol|blockquote)>)\s*<\/p>/g, "$1");
  s = s.replace(/<p>\s*<\/p>/g, "");
  s = s.replace(/<p>\s*(<hr \/>)\s*<\/p>/g, "$1");
  // Cerrar <p> suelto al inicio si quedó abierto
  s = s.replace(/^<p>(<h[23])/, "$1");

  return s;
}

function renderSEOPage(page: typeof ALL_SEO_PAGES[0]) {
  const NOINDEX_SLUGS = new Set([
    '/abogado-para-arriendos', '/abogado-gratis-online', '/abogado-urgente',
    '/abogado-accidentes', '/abogado-laboral', '/abogado-de-familia',
    '/abogado-civil', '/abogado-de-deudas', '/abogado-penal',
    '/calculadora-prescripcion-multas', '/calculadora-condonacion-multas',
  ]);
  const robotsContent = NOINDEX_SLUGS.has(page.slug) ? 'noindex, follow' : 'index, follow';
  const roleLabel = page.role === 'demandante' ? 'Quiero demandar' : page.role === 'demandado' ? 'Me demandaron' : 'Consulta legal';
  const roleColor = page.role === 'demandante' ? '#2563eb' : page.role === 'demandado' ? '#dc2626' : '#0891b2';
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const faqSchema = page.faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }));
  const related = getRelatedPages(page);
  const pageDate = process.env.SEO_PAGE_DATE || "2026-08-01";

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.titleSEO}</title>
  <meta name="description" content="${page.metaDescription}" />
  <meta name="robots" content="${robotsContent}" />
  <link rel="canonical" href="${baseUrl}${page.slug}" />
  <meta property="og:locale" content="es_CL" />
  <meta property="og:title" content="${page.titleSEO}" />
  <meta property="og:description" content="${page.metaDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${page.slug}" />
  <meta property="og:site_name" content="LegalHelp Chile" />
  <meta property="og:image" content="${baseUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${page.titleSEO}" />
  <meta name="twitter:description" content="${page.metaDescription}" />
  <meta name="twitter:image" content="${baseUrl}/og-image.png" />
  <script type="application/ld+json">
  [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${page.titleSEO}",
    "url": "${baseUrl}${page.slug}",
    "description": "${page.metaDescription}",
    "inLanguage": "es-CL",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "author": { "@type": "Person", "name": "Equipo LegalHelp Chile", "jobTitle": "Orientación Legal", "url": "https://legalhelp.cl" },
    "reviewedBy": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "publisher": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl", "logo": { "@type": "ImageObject", "url": "${baseUrl}/og-image.png" } }
  },
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "LegalHelp Chile",
    "description": "${page.metaDescription}",
    "areaServed": { "@type": "Country", "name": "Chile" },
    "serviceType": "Orientación Legal con IA",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "url": "${baseUrl}${page.slug}"
  },
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "LegalHelp Chile",
    "telephone": "+56967658939",
    "email": "contacto@legalhelp.cl",
    "url": "https://legalhelp.cl",
    "address": { "@type": "PostalAddress", "addressLocality": "Santiago", "addressRegion": "Región Metropolitana", "addressCountry": "CL" },
    "priceRange": "$$"
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": ${JSON.stringify(faqSchema)}
  },${page.slug === '/prescripcion-multas-tag' ? `
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Diagnóstico Legal Prescripción Multa TAG",
    "description": "Diagnóstico legal con IA por $19.990 CLP, derivado a abogado habilitado. Atención vía WhatsApp +56967658939",
    "offers": [
      { "@type": "Offer", "price": "19990", "priceCurrency": "CLP", "availability": "https://schema.org/InStock", "url": "${baseUrl}${page.slug}" }
    ]
  },` : ''}
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "${baseUrl}/" },
      { "@type": "ListItem", "position": 2, "name": "${page.h1}", "item": "${baseUrl}${page.slug}" }
    ]
  }${page.diagnosText.includes('Paso 1') ? `,
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "${page.h1}",
    "description": "${page.metaDescription}",
    "step": [
      { "@type": "HowToStep", "name": "Verificar prescripción", "text": "Obtén tu certificado de multas en el Registro Civil y verifica la fecha de anotación." },
      { "@type": "HowToStep", "name": "Verificar cobro judicial", "text": "Consulta en el Poder Judicial si hay juicio de cobro pendiente." },
      { "@type": "HowToStep", "name": "Redactar escrito", "text": "Elabora el escrito de solicitud de prescripción con tus datos y fundamento legal." },
      { "@type": "HowToStep", "name": "Presentar en Juzgado", "text": "Presenta el escrito en el Juzgado de Policía Local que dictó la multa." },
      { "@type": "HowToStep", "name": "Esperar resolución", "text": "El juez dicta resolución en 1-4 semanas. Si aprueba, ordina la eliminación del Registro Civil." }
    ],
    "totalTime": "P4W"
  }` : ''}
  ]
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    .breadcrumb a:hover { color: #0f172a; }
    .role-badge { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
    h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 24px; line-height: 1.2; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .diagnos-text { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
    .cta-box { background: #2563eb; color: #fff; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 32px; display: block; text-decoration: none; font-weight: 700; font-size: 15px; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
    .cta-box:hover { background: #1d4ed8; }
    .cta-box .arrow { display: inline-block; margin-left: 6px; transition: transform 0.15s; }
    .cta-box:hover .arrow { transform: translateX(3px); }
    .bullets { list-style: none; margin-bottom: 36px; }
    .bullets li { padding: 10px 0 10px 28px; position: relative; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.6; }
    .bullets li::before { content: '•'; position: absolute; left: 8px; color: #2563eb; font-weight: 700; }
    .faq-section { margin-top: 36px; }
    .faq-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .faq-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
    .faq-item .q { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .faq-item .a { font-size: 13px; color: #475569; line-height: 1.6; }
    .cta-whatsapp { display: inline-flex; align-items: center; gap: 8px; background: #25d366; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; margin-bottom: 24px; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,211,102,0.3); }
    .cta-whatsapp:hover { background: #1fb855; }
    .wa-float { position: fixed; bottom: 24px; right: 24px; z-index: 50; background: #25d366; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(37,211,102,0.4); text-decoration: none; transition: transform 0.2s; }
    .wa-float:hover { transform: scale(1.1); }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } .wa-float { bottom: 16px; right: 16px; width: 50px; height: 50px; } }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px 20px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; ${page.caseType === 'arriendo' ? 'Arriendo' : page.caseType === 'laboral' ? 'Laboral' : page.caseType === 'deuda' ? 'Deudas' : page.caseType === 'civil' ? 'Civil' : page.caseType === 'familia' ? 'Familia' : page.caseType === 'penal' ? 'Penal' : 'Legal'}</div>
    <span class="role-badge" style="background:${roleColor}15;color:${roleColor}">${roleLabel}</span>
    <h1>${page.h1}</h1>
    <p style="font-size:12px;color:#64748b;margin:-16px 0 16px;">Por <strong>Equipo LegalHelp Chile</strong> · Actualizado ${pageDate} · Revisado · <a href="https://wa.me/56967658939" style="color:#2563eb;text-decoration:none;">WhatsApp +56 9 6765 8939</a></p>
    <p class="section-label">Diagnóstico del caso</p>
    <div class="diagnos-text">${mdLite(page.diagnosText)}</div>
    <a href="/" class="cta-box">${page.ctaText} <span class="arrow">→</span></a>
    <a href="https://wa.me/56967658939?text=Hola%20LegalHelp%2C%20necesito%20orientaci%C3%B3n%20legal" target="_blank" rel="noopener noreferrer" class="cta-whatsapp">
      <svg width="18" height="18" fill="#fff" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Consultar por WhatsApp
    </a>
    <ul class="bullets">
      ${page.bullets.map(b => `<li>${mdLite(b)}</li>`).join('')}
    </ul>
    <section class="faq-section">
      <h2>Preguntas frecuentes</h2>
      ${page.faqs.map(f => `<div class="faq-item"><p class="q">${mdLite(f.q)}</p><p class="a">${mdLite(f.a)}</p></div>`).join('')}
    </section>
    ${related.length > 0 ? `<section style="margin-top:36px;"><h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;color:#0f172a;">Casos relacionados</h2><div style="display:flex;flex-wrap:wrap;gap:8px;">${related.map(r => `<a href="${r.slug}" style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;text-decoration:none;">${r.h1}</a>`).join('')}</div></section>` : ''}
    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Diagnóstico Legal Chile, herramienta de orientación legal adaptada a la legislación chilena.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
  <a href="https://wa.me/56967658939?text=Hola%20LegalHelp%2C%20necesito%20orientaci%C3%B3n%20legal" target="_blank" rel="noopener noreferrer" class="wa-float" aria-label="Contactar por WhatsApp">
    <svg width="28" height="28" fill="#fff" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  </a>
</body>
</html>`;
}

function getRelatedPages(page: typeof ALL_SEO_PAGES[0]) {
  const sameType = ALL_SEO_PAGES.filter(p => p.slug !== page.slug && p.caseType === page.caseType);
  const crossType = ALL_SEO_PAGES.filter(p => p.slug !== page.slug && p.caseType !== page.caseType);
  const order = (a: typeof ALL_SEO_PAGES[0], b: typeof ALL_SEO_PAGES[0]) => {
    const aHub = a.slug.includes('abogado') ? 0 : 1;
    const bHub = b.slug.includes('abogado') ? 0 : 1;
    return aHub - bHub || a.slug.localeCompare(b.slug);
  };
  return [...sameType.sort(order).slice(0, 6), ...crossType.sort(order).slice(0, 4)]
    .map(p => ({ slug: p.slug, h1: p.h1 }));
}

// Página hub de herramientas
function renderHerramientasPage() {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Herramientas Legales Gratis Chile 2026 | Calculadoras y Verificadores</title>
  <meta name="description" content="Herramientas legales para Chile: calculadora de prescripción de multas, calculadora de condonación 80%, verificador de multas TAG. Actualizado 2026." />
  <link rel="canonical" href="${baseUrl}/herramientas" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Herramientas Legales Gratis Chile 2026",
    "url": "${baseUrl}/herramientas",
    "description": "Herramientas legales para Chile: calculadoras de prescripción y condonación de multas TAG.",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.2; }
    .subtitle { font-size: 15px; color: #475569; margin-bottom: 32px; }
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 36px; }
    .tool-card { background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px; transition: border-color 0.15s, box-shadow 0.15s; }
    .tool-card:hover { border-color: #2563eb; box-shadow: 0 4px 20px rgba(37,99,235,0.1); }
    .tool-card .icon { font-size: 2rem; margin-bottom: 12px; }
    .tool-card h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .tool-card p { font-size: 14px; color: #475569; margin-bottom: 16px; line-height: 1.6; }
    .tool-card .btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; transition: background 0.15s; }
    .tool-card .btn:hover { background: #1d4ed8; }
    .info-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 28px; }
    .info-box h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .info-box p { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
    .info-box ul { margin-left: 20px; margin-bottom: 12px; }
    .info-box li { font-size: 14px; color: #475569; margin-bottom: 6px; line-height: 1.6; }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 16px; transition: background 0.15s; }
    .cta-whatsapp:hover { background: #1fb855; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } .tools-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; Herramientas</div>
    <h1>Herramientas Legales Gratis Chile 2026</h1>
    <p class="subtitle">Calculadoras, verificadores y herramientas legales para resolver tus problemas con multas de tránsito y TAG en Chile.</p>

    <div class="tools-grid">
      <div class="tool-card">
        <div class="icon">⏳</div>
        <h2>Calculadora de Prescripción de Multas</h2>
        <p>¿Tu multa TAG ya prescribió? Ingresa la fecha de anotación y te decimos si puedes eliminarla legalmente.</p>
        <a href="/calculadora-prescripcion-multas" class="btn">Calcular Prescripción →</a>
      </div>
      <div class="tool-card">
        <div class="icon">💰</div>
        <h2>Calculadora de Condonación 80%</h2>
        <p>¿Cuánto pagas con el 80% de descuento? Ingresa el monto original y descubre tu precio final.</p>
        <a href="/calculadora-condonacion-multas" class="btn">Calcular Descuento →</a>
      </div>
    </div>

    <div class="info-box">
      <h2>¿Qué hacer con tus multas TAG?</h2>
      <p>Si tienes multas de tránsito o TAG pendientes, tienes opciones:</p>
      <ul>
        <li><strong>Prescripción:</strong> Si han pasado más de 12 meses desde la anotación, tu multa prescribió y puedes eliminarla</li>
        <li><strong>Condonación 80%:</strong> Si pagas antes del 30 de septiembre de 2026, solo pagas el 20%</li>
        <li><strong>Defensa técnica:</strong> Si la multa tiene errores administrativos, puedes impugnarla</li>
      </ul>
      <p>Nuestro equipo de abogados puede ayudarte con el proceso completo.</p>
      <a href="https://wa.me/56967658939?text=Hola%2C+necesito+ayuda+con+mis+multas+TAG" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a>
    </div>

    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Herramientas legales adaptadas a la legislación chilena vigente.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
</body>
</html>`;
}

// Calculadoras interactivas (prescripción y condonación)
function renderCalculatorPage(calc: { slug: string; titleSEO: string; metaDescription: string; h1: string; description: string }) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const pageDate = process.env.SEO_PAGE_DATE || "2026-09-01";
  const isPrescripcion = calc.slug.includes('prescripcion');
  const calculatorJS = isPrescripcion ? `
<script>
function calcularPrescripcion() {
  const input = document.getElementById('fecha-anotacion');
  const resultado = document.getElementById('resultado');
  const error = document.getElementById('error-msg');
  if (!input.value) { error.textContent = 'Selecciona la fecha de anotación'; resultado.innerHTML = ''; return; }
  error.textContent = '';
  const fechaAnotacion = new Date(input.value);
  const hoy = new Date();
  const diffMs = hoy - fechaAnotacion;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffAnios = diffDias / 365.25;
  const prescrita = diffAnios >= 1;
  const diasRestantes = prescrita ? 0 : Math.ceil((365.25 - diffDias));
  const mesesRestantes = Math.floor(diasRestantes / 30);
  const diasFinales = diasRestantes % 30;
  if (prescrita) {
    resultado.innerHTML = '<div class="result-box result-green"><h3>✅ Tu multa YA PRESCRIBIÓ</h3><p>Desde el ' + fechaAnotacion.toLocaleDateString('es-CL') + ' han pasado <strong>' + Math.floor(diffAnios) + ' años</strong>.</p><p>Según el art. 2497 del Código Civil chileno, tu multa prescribió el <strong>' + new Date(fechaAnotacion.getTime() + 365.25*24*60*60*1000).toLocaleDateString('es-CL') + '</strong>.</p><p><strong>Puedes solicitar la eliminación de esta multa.</strong></p><a href="https://wa.me/56967658939?text=Hola%2C+mi+multa+TAG+ya+prescribió.+Fecha+de+anotaci%C3%B3n%3A+' + input.value + '" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a></div>';
  } else {
    resultado.innerHTML = '<div class="result-box result-yellow"><h3>⏳ Tu multa AÚN NO prescribe</h3><p>Desde el ' + fechaAnotacion.toLocaleDateString('es-CL') + ' han pasado <strong>' + Math.floor(diffAnios) + ' años y ' + Math.floor((diffAnios % 1) * 12) + ' meses</strong>.</p><p>Tu multa prescribirá el <strong>' + new Date(fechaAnotacion.getTime() + 365.25*24*60*60*1000).toLocaleDateString('es-CL') + '</strong>.</p><p><strong>Faltan ' + mesesRestantes + ' meses y ' + diasFinales + ' días.</strong></p><a href="https://wa.me/56967658939?text=Hola%2C+quiero+saber+cuando+prescribe+mi+multa+TAG.+Fecha%3A+' + input.value + '" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a></div>';
  }
}
</script>` : `
<script>
function calcularCondonacion() {
  const input = document.getElementById('monto-original');
  const resultado = document.getElementById('resultado');
  const error = document.getElementById('error-msg');
  if (!input.value || parseFloat(input.value) <= 0) { error.textContent = 'Ingresa un monto válido'; resultado.innerHTML = ''; return; }
  error.textContent = '';
  const monto = parseFloat(input.value);
  const descuento = monto * 0.8;
  const final = monto * 0.2;
  const ahorro = descuento;
  resultado.innerHTML = '<div class="result-box result-green"><h3>💰 Con el 80% de descuento pagas</h3><div class="monto-final">$' + Math.round(final).toLocaleString('es-CL') + ' CLP</div><div class="detail-row"><span>Monto original:</span><span>$' + monto.toLocaleString('es-CL') + '</span></div><div class="detail-row"><span>Descuento (80%):</span><span class="ahorro">-$' + Math.round(ahorro).toLocaleString('es-CL') + '</span></div><div class="detail-row"><span>Fecha límite:</span><span>30 de septiembre 2026</span></div><p style="margin-top:16px;font-size:13px;color:#475569;">El 80% de descuento se aplica al valor total de la multa. Solo pagas el 20% restante.</p><a href="https://wa.me/56967658939?text=Hola%2C+quiero+aplicar+el+80%25+de+condonaci%C3%B3n+de+mi+multa+TAG.+Monto%3A+$' + monto + '" class="cta-whatsapp" target="_blank">💬 Aplicar Descuento por WhatsApp</a></div>';
}
</script>`;

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${calc.titleSEO}</title>
  <meta name="description" content="${calc.metaDescription}" />
  <link rel="canonical" href="${baseUrl}${calc.slug}" />
  <meta property="og:title" content="${calc.titleSEO}" />
  <meta property="og:description" content="${calc.metaDescription}" />
  <meta property="og:url" content="${baseUrl}${calc.slug}" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "${calc.h1}",
    "operatingSystem": "Web",
    "applicationCategory": "LegalApplication",
    "url": "${baseUrl}${calc.slug}",
    "description": "${calc.metaDescription}",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CLP" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    h1 { font-size: 1.8rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.2; }
    .subtitle { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .calc-box { background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px; margin-bottom: 28px; }
    .calc-box label { display: block; font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px; }
    .calc-box input { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; margin-bottom: 8px; transition: border-color 0.15s; }
    .calc-box input:focus { outline: none; border-color: #2563eb; }
    .error-msg { color: #dc2626; font-size: 13px; margin-bottom: 12px; min-height: 20px; }
    .btn-calc { width: 100%; background: #2563eb; color: #fff; border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
    .btn-calc:hover { background: #1d4ed8; }
    .result-box { border-radius: 12px; padding: 24px; margin-top: 20px; }
    .result-green { background: #f0fdf4; border: 2px solid #86efac; }
    .result-yellow { background: #fefce8; border: 2px solid #fde047; }
    .result-box h3 { font-size: 18px; margin-bottom: 12px; }
    .result-box p { font-size: 14px; color: #334155; margin-bottom: 8px; }
    .monto-final { font-size: 2.5rem; font-weight: 800; color: #16a34a; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .detail-row .ahorro { color: #16a34a; font-weight: 700; }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 16px; transition: background 0.15s; }
    .cta-whatsapp:hover { background: #1fb855; }
    .info-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 28px; }
    .info-section h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .info-section p { font-size: 14px; color: #475569; margin-bottom: 12px; line-height: 1.7; }
    .info-section ul { margin-left: 20px; margin-bottom: 12px; }
    .info-section li { font-size: 14px; color: #475569; margin-bottom: 6px; line-height: 1.6; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.4rem; } .main-wrap { padding: 24px 16px 40px; } .monto-final { font-size: 2rem; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; <a href="/herramientas">Herramientas</a> &rsaquo; ${calc.h1}</div>
    <h1>${calc.h1}</h1>
    <p class="subtitle">${calc.description}</p>

    <div class="calc-box">
      ${isPrescripcion ? `
      <label for="fecha-anotacion">Fecha de anotación de la multa:</label>
      <input type="date" id="fecha-anotacion" />
      <div id="error-msg" class="error-msg"></div>
      <button class="btn-calc" onclick="calcularPrescripcion()">Calcular Prescripción</button>
      ` : `
      <label for="monto-original">Monto original de la multa (CLP):</label>
      <input type="number" id="monto-original" placeholder="Ej: 80000" min="1" />
      <div id="error-msg" class="error-msg"></div>
      <button class="btn-calc" onclick="calcularCondonacion()">Calcular Descuento 80%</button>
      `}
      <div id="resultado"></div>
    </div>

    <div class="info-section">
      ${isPrescripcion ? `
      <h2>¿Cómo funciona la prescripción de multas TAG?</h2>
      <p>Según el art. 2497 del Código Civil chileno, las multas de tránsito prescriben a <strong>1 año</strong> desde su anotación en el Registro de Vehículos Recuperados o en el Registro Nacional de Vehículos Motorizados.</p>
      <ul>
        <li>El plazo de 1 año es improrrogable</li>
        <li>La prescripción se cuenta desde la fecha de anotación, no desde la fecha de la infracción</li>
        <li>Una vez prescrita, la multa no puede ser cobrada</li>
        <li>Puedes solicitar la eliminación ante el Juzgado de Policía Local</li>
      </ul>
      <p><strong>Artículo 2497 del Código Civil:</strong> "Las acciones prescriben por el transcurso del tiempo señalado por la ley."</p>
      <h2 style="margin-top:20px;">¿Qué hacer si tu multa ya prescribió?</h2>
      <ul>
        <li>Obtén el certificado de anotaciones vigentes en <a href="https://www.registrocivil.cl" target="_blank">registrocivil.cl</a></li>
        <li>Identifica la fecha exacta de anotación de cada multa</li>
        <li>Si han pasado más de 12 meses, la multa prescribió</li>
        <li>Presenta un recurso de apelación ante el Juzgado de Policía Local</li>
        <li>O solicita la eliminación directa en la Municipalidad</li>
      </ul>
      ` : `
      <h2>¿Cómo funciona el 80% de condonación de multas TAG?</h2>
      <p>El Decreto Supremo del Ministerio Público de Transito y Telecomunicaciones establece un <strong>80% de descuento</strong> sobre el valor total de multas de tránsito para pagos realizados antes del <strong>30 de septiembre de 2026</strong>.</p>
      <ul>
        <li>El descuento es del 80% sobre el monto original</li>
        <li>Solo pagas el 20% restante</li>
        <li>Aplica a multas de tránsito y TAG</li>
        <li>La fecha límite es el 30 de septiembre de 2026</li>
        <li>Se puede pagar en cualquier Banco o portal de pago autorizado</li>
      </ul>
      <p><strong>Ejemplo:</strong> Si tu multa es de $80.000, con el 80% de descuento pagas solo $16.000.</p>
      <h2 style="margin-top:20px;">¿Cómo aplicar el descuento?</h2>
      <ul>
        <li>Ingresa a <a href="https://consultas.mtt.cl" target="_blank">consultas.mtt.cl</a> con tu RUT</li>
        <li>Selecciona las multas que quieres pagar</li>
        <li>El sistema aplicará automáticamente el 80% de descuento</li>
        <li>Elige el medio de pago y completa la transacción</li>
        <li>Guarda el comprobante de pago</li>
      </ul>
      `}
    </div>

    <div class="info-section" style="margin-top:20px;">
      <h2>¿Necesitas ayuda profesional?</h2>
      <p>Servicio de prescripción de multas: análisis técnico $15.000 CLP + redacción de escrito $10.000 CLP por juzgado. Multas del mismo tribunal se agrupan en un solo escrito.</p>
      <a href="https://wa.me/56967658939?text=Hola%2C+necesito+ayuda+con+mis+multas+TAG" class="cta-whatsapp" target="_blank">💬 Consultar por WhatsApp</a>
    </div>

    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Herramienta de orientación legal adaptada a la legislación chilena vigente.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
  ${calculatorJS}
</body>
</html>`;
}

// Homepage SSR: static crawlable content inside #root (React replaces it on hydration)
function serveHomePage(_req: express.Request, res: express.Response) {
  const indexPath = path.join(distPath, "index.html");
  const html = fs.readFileSync(indexPath, "utf-8");
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const content = renderHomeContent(baseUrl);
  const withContent = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(withContent);
}

// Renderiza página de prescripción por comuna — embudo de conversión
function renderTribunalPage(comuna: typeof COMUNAS_RM[0]) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const slug = `/prescripcion-multas/${comuna.slug}`;
  const titleSEO = `Prescripción de Multas y TAG en ${comuna.comuna} | LegalHelp Chile`;
  const metaDescription = `Servicio de prescripción de multas y TAG en ${comuna.comuna}. Análisis técnico $15.000 CLP + redacción de escrito $10.000 CLP por juzgado. Multas del mismo tribunal se agrupan en un solo escrito. Atención vía WhatsApp.`;
  const h1 = `Prescripción de Multas y TAG en ${comuna.comuna}: Servicio ante ${comuna.juzgados[0].nombre}`;
  const pageDate = process.env.SEO_PAGE_DATE || "2026-08-01";
  const numJuzgados = comuna.juzgados.length;
  const whatsappMsg = `Hola, tengo multas en ${comuna.comuna} y quiero contratar el análisis de mis multas y redacción de escritos de prescripción.`;
  const whatsappUrl = `https://wa.me/56967658939?text=${encodeURIComponent(whatsappMsg)}`;

  // Detectar tipo de canal principal
  const canales = comuna.juzgados.map(j => j.canalIngreso);
  const tieneOnline = canales.includes('ONLINE');
  const tienePresencial = canales.includes('PRESENCIAL');
  const tieneHibrido = canales.includes('HÍBRIDO');

  // Generar bloque de canal adaptado (solo info del canal, sin tutorial)
  let canalInfoCorta = '';
  if (tieneOnline && !tienePresencial) {
    canalInfoCorta = `<p>Los JPL de ${comuna.comuna} aceptan escritos <strong>por vía digital</strong>. Nuestro equipo conoce los requisitos exactos de firma electrónica y plataforma para cada juzgado.</p>`;
  } else if (tienePresencial && !tieneOnline) {
    canalInfoCorta = `
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
        <p style="font-weight:700;color:#92400e;margin-bottom:4px;">⚠️ Este juzgado NO acepta correos electrónicos</p>
        <p style="color:#92400e;font-size:13px;">Los JPL de ${comuna.comuna} solo reciben escritos presencialmente en el buzón de partes. Enviar por correo provoca rechazo automático.</p>
      </div>`;
  } else if (tieneHibrido) {
    canalInfoCorta = `<p>Los JPL de ${comuna.comuna} operan en <strong>modalidad híbrida</strong>: aceptan notificaciones por correo, pero el escrito de prescripción debe depositarse en el buzón físico. Manejamos ambos canales según corresponda.</p>`;
  }

  // Generar tabla de JPLs (se mantiene para SEO local)
  const tablaJplRows = comuna.juzgados.map(j => {
    const canalIcon = j.canalIngreso === 'ONLINE' ? '🟢' : j.canalIngreso === 'HÍBRIDO' ? '🟡' : '🔴';
    const canalLabel = j.canalIngreso === 'ONLINE' ? 'Online' : j.canalIngreso === 'HÍBRIDO' ? 'Híbrido' : 'Presencial';
    const certezaColor = j.certeza === 'Alto' ? '#16a34a' : j.certeza === 'Medio' ? '#ca8a04' : '#dc2626';
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${j.nombre}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${canalIcon} ${canalLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${j.detalleCanal}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${j.correo}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><span style="color:${certezaColor};font-weight:600;">${j.certeza}</span></td>
      </tr>`;
  }).join('');

  // Comparación entre JPLs (solo si hay mixed channels)
  let comparacionBloque = '';
  if (tieneOnline && tienePresencial) {
    comparacionBloque = `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <p style="font-weight:700;color:#166534;margin-bottom:4px;">💡 Dato importante para ${comuna.comuna}</p>
        <p style="color:#166534;font-size:13px;">En ${comuna.comuna}, algunos JPL aceptan escritos por correo electrónico mientras que otros solo operan de forma presencial. Si tienes multas asignadas a diferentes juzgados, es posible que necesites escritos separados por cada canal. Nosotros gestionamos cada uno según las reglas del tribunal.</p>
      </div>`;
  }

  // FAQs (enfocadas en contratación, no en tutorial)
  const faqs = [
    { q: `¿Qué incluye el servicio de prescripción de multas en ${comuna.comuna}?`, a: `El servicio incluye: (1) Análisis técnico de tu certificado de multas para identificar cuáles son prescribibles, y (2) Redacción del escrito de prescripción adaptado a cada JPL de ${comuna.comuna}, respetando el canal de ingreso (digital, presencial o híbrido).` },
    { q: `¿Cuánto cuesta prescribir multas en ${comuna.comuna}?`, a: `El costo tiene dos partes: $15.000 CLP por el análisis técnico inicial del certificado de multas, y $10.000 CLP por cada escrito redactado por juzgado. Si tienes 10 multas en un mismo juzgado, se agrupan en un solo escrito: solo pagas un cargo de redacción.` },
    { q: `¿Cuánto tarda el proceso completo?`, a: `El análisis y redacción se entregan en 2 a 5 días hábiles. La resolución del juez tarda entre 1 y 3 meses desde la presentación del escrito.` },
    { q: `¿Qué pasa si el juez rechaza mi solicitud?`, a: `Nuestro servicio incluye revisión previa para minimizar el riesgo de rechazo. Si aun así occurriese, te asesoramos sobre los pasos a seguir (apelación dentro de 5 días hábiles).` },
    { q: `¿Puedo hacerlo yo mismo sin contratar el servicio?`, a: `Sí, puedes intentarlo. Sin embargo, un error en el cómputo de plazos o en los requisitos formales del escrito provoca el rechazo automático del tribunal y la ejecución de la deuda. Nuestro servicio elimina ese riesgo.` },
  ];

  const faqSchema = faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }));

  // Comunas relacionadas (otras comunas RM)
  const comunasRelacionadas = COMUNAS_RM.filter(c => c.slug !== comuna.slug).slice(0, 8);

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleSEO}</title>
  <meta name="description" content="${metaDescription}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}${slug}" />
  <meta property="og:locale" content="es_CL" />
  <meta property="og:title" content="${titleSEO}" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${slug}" />
  <meta property="og:site_name" content="LegalHelp Chile" />
  <meta property="og:image" content="${baseUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${titleSEO}" />
  <meta name="twitter:description" content="${metaDescription}" />
  <meta name="twitter:image" content="${baseUrl}/og-image.png" />
  <meta name="ai-content-declaration" content="human-authored" />
  <script type="application/ld+json">
  [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${titleSEO}",
    "url": "${baseUrl}${slug}",
    "description": "${metaDescription}",
    "inLanguage": "es-CL",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "author": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "publisher": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "speakable": {
      "@type": "Speakable",
      "cssSelector": [".diagnos-text", ".faq-section"]
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "LegalHelp Chile",
    "description": "${metaDescription}",
    "areaServed": { "@type": "City", "name": "${comuna.comuna}" },
    "serviceType": "Prescripción de Multas y TAG",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "url": "${baseUrl}${slug}"
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": ${JSON.stringify(faqSchema)}
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "${baseUrl}/" },
      { "@type": "ListItem", "position": 2, "name": "Prescripción de Multas", "item": "${baseUrl}/prescripcion-multas-tag" },
      { "@type": "ListItem", "position": 3, "name": "${comuna.comuna}", "item": "${baseUrl}${slug}" }
    ]
  }
  ]
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    .breadcrumb a:hover { color: #0f172a; }
    h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 24px; line-height: 1.2; }
    h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 24px 0 12px; }
    h3 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 16px 0 8px; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .diagnos-text { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
    .cta-box { background: #2563eb; color: #fff; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 32px; display: block; text-decoration: none; font-weight: 700; font-size: 15px; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
    .cta-box:hover { background: #1d4ed8; }
    .cta-box .arrow { display: inline-block; margin-left: 6px; transition: transform 0.15s; }
    .cta-box:hover .arrow { transform: translateX(3px); }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 24px 0; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,99,235,0.15); }
    .cta-whatsapp:hover { background: #1fb855; }
    .jpl-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .jpl-table th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .diagnos-text ul, .diagnos-text ol { margin: 12px 0; padding-left: 24px; }
    .diagnos-text li { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
    .faq-section { margin-top: 36px; }
    .faq-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .faq-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
    .faq-item .q { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .faq-item .a { font-size: 13px; color: #475569; line-height: 1.6; }
    .comunas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 16px; }
    .comunas-grid a { display: block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; transition: all 0.15s; }
    .comunas-grid a:hover { background: #dbeafe; border-color: #93c5fd; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px 20px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } .jpl-table { font-size: 12px; } .jpl-table th, .jpl-table td { padding: 8px 6px; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; <a href="/prescripcion-multas-tag">Prescripción de Multas</a> &rsaquo; ${comuna.comuna}</div>
    <h1>${h1}</h1>

    <!-- CTA WhatsApp inmediato bajo el H1 -->
    <a href="${whatsappUrl}" class="cta-whatsapp">📱 Contratar análisis y redacción de escritos de prescripción en ${comuna.comuna}</a>

    <!-- Ficha técnica del JPL (SEO local) -->
    <p class="section-label">Ficha del Juzgado de Policía Local</p>
    <div class="diagnos-text">
      <table class="jpl-table">
        <thead>
          <tr>
            <th>Juzgado</th>
            <th>Canal</th>
            <th>Detalle</th>
            <th>Contacto</th>
            <th>Certeza</th>
          </tr>
        </thead>
        <tbody>
          ${tablaJplRows}
        </tbody>
      </table>
      ${canalInfoCorta}
    </div>
    ${comparacionBloque}

    <!-- MURO DE FRICCIÓN: Riesgo jurídico -->
    <div class="diagnos-text" style="border-left:4px solid #dc2626;">
      <h2 style="color:#dc2626;margin-top:0;">⚠️ Evite el rechazo del Juzgado de Policía Local</h2>
      <p>Presentar un escrito de prescripción con errores formales provoca el <strong>rechazo automático</strong> del tribunal. Las causales más comunes de rechazo son:</p>
      <ul>
        <li><strong>Confusión de plazos:</strong> Las multas de tránsito (conductor) prescriben a <strong>1 año</strong>. Las de TAG y permiso de circulación prescriben a <strong>3 años</strong>. Aplicar el plazo incorrecto en el escrito es causal de rechazo inmediato.</li>
        <li><strong>Falla en el canal de ingreso:</strong> Enviar un escrito por correo electrónico a un JPL que solo acepta buzón presencial (o viceversa) resulta en rechazo ipso facto. Cada juzgado tiene reglas distintas.</li>
        <li><strong>Error en la firma:</strong> Los canales digitales exigen firma electrónica avanzada o Clave Única. Una firma simple o manuscrita escaneada no es aceptada.</li>
        <li><strong>Datos incompletos:</strong> Omisión de RUT, patente, número de multa o fecha de infracción. El juez declarará el escrito incompleto y lo devolverá.</li>
      </ul>
      <p style="font-weight:700;color:#0f172a;">Un rechazo no es solo un trámite extra: significa que la multa vuelve a estar vigente y puede ser ejecutada coactivamente por el Fisco.</p>
    </div>

    <!-- BLOQUE DE OFERTA COMERCIAL -->
    <div class="diagnos-text" style="background:#f0fdf4;border:2px solid #22c55e;">
      <h2 style="color:#166534;margin-top:0;">Servicio de Prescripción de Multas en ${comuna.comuna}</h2>
      <p>Nuestro equipo se encarga de todo el proceso técnico. Tú solo nos envías tu certificado de multas y nosotros gestionamos la prescripción ante cada JPL.</p>

      <h3 style="color:#166534;">¿Qué incluye el servicio?</h3>
      <ol>
        <li><strong>Diagnóstico Legal ($19.990 CLP):</strong> Revisión exhaustiva de tu certificado de multas para identificar qué infracciones son prescribibles según el plazo legal aplicable (1 año tránsito, 3 años TAG/permiso de circulación), derivado a un abogado habilitado.</li>
      </ol>

      <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:16px 0;">
        <p style="font-weight:700;color:#166534;margin-bottom:4px;">💡 Ahorro por agrupación de multas</p>
        <p style="color:#166534;font-size:14px;">No se cobra por cada multa individual. Si tienes, por ejemplo, <strong>10 multas en el mismo juzgado</strong>, todas se agrupan en un <strong>único escrito</strong>. Solo pagas un cargo único de diagnóstico de $19.990, independientemente de la cantidad de infracciones.</p>
      </div>

      <p style="font-size:14px;color:#334155;"><strong>Ejemplo:</strong> 5 multas de tránsito + 3 multas de TAG en ${numJuzgados > 1 ? numJuzgados + ' juzgados distintos' : '1 juzgado'} = <strong>$19.990 CLP total</strong> (diagnóstico + derivación a abogado).</p>

      <a href="${whatsappUrl}" class="cta-box" style="margin-top:20px;">Solicitar análisis de mis multas por WhatsApp <span class="arrow">→</span></a>
    </div>

    <!-- Enlaces internos a guía y herramientas -->
    <div class="diagnos-text" style="background:#eff6ff;border:1px solid #bfdbfe;">
      <h2 style="color:#1d4ed8;margin-top:0;font-size:1rem;">Recursos sobre prescripción de multas</h2>
      <ul style="margin:8px 0;padding-left:20px;">
        <li><a href="/prescripcion-multas-tag" style="color:#2563eb;font-weight:600;">Guía completa de prescripción multas TAG Chile 2026</a> — Plazos, requisitos y paso a paso</li>
        <li><a href="/prescripcion-de-multas-de-transito" style="color:#2563eb;font-weight:600;">Cómo eliminar multas de tránsito por prescripción</a> — Art. 2497 Código Civil</li>
        <li><a href="/calculadora-prescripcion-multas" style="color:#2563eb;font-weight:600;">Calculadora de prescripción</a> — Verifica si tu multa ya prescribió</li>
        <li><a href="/calculadora-condonacion-multas" style="color:#2563eb;font-weight:600;">Calculadora de condonación 80%</a> — Descubre cuánto pagas con el descuento</li>
      </ul>
    </div>

    <!-- CTA WhatsApp secundario -->
    <a href="${whatsappUrl}" class="cta-whatsapp">📱 Consultar prescripción de multas en ${comuna.comuna} por WhatsApp</a>

    <!-- FAQs (enfocadas en contratación) -->
    <section class="faq-section">
      <h2>Preguntas frecuentes sobre prescripción de multas en ${comuna.comuna}</h2>
      ${faqs.map(f => `<div class="faq-item"><p class="q">${f.q}</p><p class="a">${f.a}</p></div>`).join('')}
    </section>

    <!-- Comunas relacionadas -->
    <section style="margin-top:36px;">
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;color:#0f172a;">Otras comunas de la Región Metropolitana</h2>
      <div class="comunas-grid">
        ${comunasRelacionadas.map(c => `<a href="/prescripcion-multas/${c.slug}">${c.comuna}</a>`).join('')}
      </div>
    </section>

    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Prescripción de multas y TAG, servicio legal automatizado adaptado a la legislación chilena.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
      <p style="margin-top:4px;">Datos de JPL verificados en ${pageDate}. Fuente: <a href="https://www.bcn.cl/leychile/navegar?idNorma=1170498" style="color:#64748b;">Ley Chile BCN</a>.</p>
    </div>
  </main>
</body>
</html>`;
}

// Register SEO static routes + sitemap + robots
function registerSEORoutes() {
  // Redirecciones 301 para URLs legadas /p/* (SEO histórico) hacia páginas actuales
  app.get("/p/:slug", (req, res) => {
    res.redirect(301, resolvePseoRedirect(req.params.slug));
  });

  // Páginas programáticas: prescripción de multas por comuna (RM)
  app.get("/prescripcion-multas/:comuna", (req, res) => {
    const comuna = COMUNAS_RM.find(c => c.slug === req.params.comuna);
    if (!comuna) return res.redirect(301, "/prescripcion-multas-tag");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderTribunalPage(comuna));
  });

  for (const page of ALL_SEO_PAGES) {
    app.get(page.slug, (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderSEOPage(page));
    });
  }

  // Herramientas / calculadoras interactivas
  app.get("/herramientas", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderHerramientasPage());
  });

  for (const calc of CALCULATOR_PAGES) {
    app.get(calc.slug, (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderCalculatorPage(calc));
    });
  }

  // Redirecciones 301 para URLs directas (no /p/*) — city-specific slugs
  // IMPORTANTE: debe ir DESPUÉS de las rutas SEO para no interferir
  app.get("/:slug", (req, res, next) => {
    const dest = resolvePseoRedirect(req.params.slug);
    if (dest && dest !== '/') return res.redirect(301, dest);
    next();
  });

  // Sitemap Index: pointing to 4 sub-sitemaps
  app.get("/sitemap.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-09-08";
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-new.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-comunas.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-home.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`);
  });

  // Sitemap: new SEO pages + calculadoras (sin comunas)
  app.get("/sitemap-new.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-09-08";
    const seoUrls = ALL_SEO_PAGES.map(p => {
      const priority = p.slug === '/' ? '1.0' : '0.8';
      return `  <url>
    <loc>${baseUrl}${p.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }).join('\n');
    const calcUrls = CALCULATOR_PAGES.map(c => `  <url>
    <loc>${baseUrl}${c.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n');
    const herramientasUrl = `  <url>
    <loc>${baseUrl}/herramientas</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoUrls}
${herramientasUrl}
${calcUrls}
</urlset>`);
  });

  // Sitemap: 24 páginas pSEO de comunas (embudo de conversión)
  app.get("/sitemap-comunas.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-09-08";
    const comunasUrls = COMUNAS_RM.map(c => `  <url>
    <loc>${baseUrl}/prescripcion-multas/${c.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${comunasUrls}
</urlset>`);
  });

  // Sitemap: old /p/* URLs (708 redirects) — helps Google discover the 301s
  // DEPRECATED: sitemap-redirects.xml removed from index. Return 404 to stop Google crawling.
  app.get("/sitemap-redirects.xml", (_req, res) => {
    res.status(404).send("Not found");
  });

  // Sitemap: home only
  app.get("/sitemap-home.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-09-08";
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  });

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`User-Agent: *
Allow: /
Disallow: /api/
Disallow: /p/
Disallow: /*?*

User-Agent: GPTBot
User-Agent: OAI-SearchBot
User-Agent: PerplexityBot
User-Agent: ClaudeBot
User-Agent: Google-Extended
User-Agent: CCBot
User-Agent: Bytespider
User-Agent: meta-externalagent
User-Agent: Applebot-Extended
User-Agent: anthropic-ai
User-Agent: Amazonbot
Allow: /

Sitemap: https://legalhelp.cl/sitemap.xml
`);
  });

  // Bing Site Verification (Bing Webmaster Tools)
  app.get("/BingSiteAuth.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0"?>
<users>
	<user>5FA314B20BB93FD6E5357FBFF4B76C39</user>
</users>`);
  });

  // IndexNow key (Bing/Yandex/Seznam): https://www.indexnow.org/documentation
  const INDEXNOW_KEY = "28ff68bc2e761ea86f7ba9b100045687";
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(INDEXNOW_KEY);
  });

  // llms.txt (GEO): contexto para LLMs y AI Overviews
  app.get("/llms.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const sections: Record<string, string> = {
      arriendo: "Arriendo y desalojo",
      laboral: "Laboral y despidos",
      deuda: "Deudas, cobranza y embargos",
      familia: "Familia, alimentos y divorcio",
      civil: "Civil, contratos y herencias",
      penal: "Penal, denuncias y detención",
      general: "General y abogados",
    };
    const byType: Record<string, typeof ALL_SEO_PAGES> = {};
    for (const p of ALL_SEO_PAGES) {
      (byType[p.caseType] ||= []).push(p);
    }
    const parts: string[] = [
      "# LegalHelp Chile",
      "",
      "> Diagnóstico legal con IA en Chile. Orientación sobre demandas, plazos fatales (CPC, Código del Trabajo, Ley 19.968), arriendo, laboral, deudas, familia, civil y penal. No constituye asesoría legal formal; no reemplaza el patrocinio de un abogado habilitado en Chile.",
      "",
      "> Consulta gratuita con IA: sube tu caso y recibe diagnóstico con plazos, riesgos y pasos a seguir. Enlaces: [Diagnóstico](https://legalhelp.cl/) · [Orientación legal](https://legalhelp.cl/necesito-orientacion-legal) · [Abogado urgente](https://legalhelp.cl/abogado-urgente)",
      "",
      "## Guías por tema",
      "",
    ];
    for (const [type, label] of Object.entries(sections)) {
      const pages = (byType[type] || []).sort((a, b) => a.slug.localeCompare(b.slug));
      if (!pages.length) continue;
      parts.push(`### ${label}`, "");
      for (const p of pages) {
        parts.push(`- [${p.h1}](${baseUrl}${p.slug}): ${p.metaDescription}`);
      }
      parts.push("");
    }
    parts.push(
      "## Recursos oficiales de Chile",
      "",
      "- [Poder Judicial de Chile](https://www.pjud.cl)",
      "- [Biblioteca del Congreso Nacional - Ley Fácil](https://www.bcn.cl)",
      "- [SERNAC](https://www.sernac.cl)",
      "- [Dirección del Trabajo](https://www.dt.gob.cl)",
      "",
      "## Prescripción de multas por comuna (Región Metropolitana)",
      "",
    );
    for (const c of COMUNAS_RM.sort((a, b) => a.comuna.localeCompare(b.comuna))) {
      parts.push(`- [Prescripción de multas en ${c.comuna}](${baseUrl}/prescripcion-multas/${c.slug}): JPLs: ${c.juzgados.map(j => j.nombre).join(', ')}. Canal: ${c.juzgados[0].canalIngreso}.`);
    }
    parts.push("");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(parts.join("\n"));
  });

  // llms-full.txt: version ampliada con el texto de diagnostico completo de cada pagina
  app.get("/llms-full.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const blocks = ALL_SEO_PAGES
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(p => `# ${p.h1}\n\nURL: ${baseUrl}${p.slug}\n\n${p.diagnosText}\n\nPuntos clave:\n${p.bullets.map(b => `- ${b}`).join('\n')}\n\nPreguntas frecuentes:\n${p.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}`)
      .join('\n\n---\n\n');
    const comunasBlocks = COMUNAS_RM
      .sort((a, b) => a.comuna.localeCompare(b.comuna))
      .map(c => {
        const canalLabel = c.juzgados[0].canalIngreso;
        return `# Prescripción de Multas y TAG en ${c.comuna}\n\nURL: ${baseUrl}/prescripcion-multas/${c.slug}\n\nJPLs: ${c.juzgados.map(j => `${j.nombre} (${j.canalIngreso})`).join(', ')}\n\nCanal de ingreso: ${canalLabel}\n\nDetalle: ${c.juzgados[0].detalleCanal}`;
      })
      .join('\n\n---\n\n');
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# LegalHelp Chile - Contenido completo\n\n> Orientación legal con IA para Chile. Fuente oficial del sitio https://legalhelp.cl. No constituye asesoría legal formal.\n\n${blocks}\n\n---\n\n${comunasBlocks}`);
  });

  // ai.txt: información para LLMs y crawlers de IA
  app.get("/ai.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# LegalHelp Chile - Información para IA

> Sitio web de orientación legal con inteligencia artificial para Chile.
> No constituye asesoría legal formal ni reemplaza un abogado habilitado.

## Contenido disponible

- Prescripción de multas y TAG por comuna (24 comunas Región Metropolitana)
- Prescripción de multas de tránsito
- Defensa de infracciones de tránsito
- Limpieza de hoja de vida del conductor
- Calculadoras legales interactivas

## Datos estructurados

- Schema.org: LegalService, FAQPage, BreadcrumbList, Speakable
- Formato: JSON-LD
- Idioma: es-CL (español de Chile)

## Contacto

- WhatsApp: +56967658939
- Web: ${baseUrl}

## Comunas disponibles

${COMUNAS_RM.map(c => `- ${c.comuna}: ${baseUrl}/prescripcion-multas/${c.slug}`).join('\n')}
`);
  });
}

const distPath = path.join(process.cwd(), "dist");

// Serve static build + SSR home (production on Vercel and local preview)
app.use(express.static(distPath, { index: false }));
app.get("/", serveHomePage);

// Vercel / Serverless export: handler receives all requests (routes SEO + API + SPA fallback)
export const handler = app;
export default app;

// Only run the persistent server locally (not on Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  registerSEORoutes();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Diagnóstico Legal Chile corriendo en http://localhost:${PORT}`);
  });
} else {
  registerSEORoutes();
  // Custom 404: serve 404.html for unmatched routes instead of SPA fallback
  app.get("*", (req, res) => {
    const notFoundPath = path.join(distPath, "404.html");
    if (require("fs").existsSync(notFoundPath)) {
      res.status(404).sendFile(notFoundPath);
    } else {
      res.status(404).send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>404 - Página no encontrada | LegalHelp Chile</title><meta name="robots" content="noindex"><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#05070f;color:#e0e6f0}.box{text-align:center;max-width:480px;padding:2rem}h1{font-size:4rem;margin:0;color:#00d4ff}p{font-size:1.1rem;line-height:1.6;color:#a0aec0}a{color:#00d4ff;text-decoration:none;border:1px solid #00d4ff;padding:.5rem 1.5rem;border-radius:6px;display:inline-block;margin-top:1rem;transition:all .2s}a:hover{background:#00d4ff;color:#05070f}</style></head><body><div class="box"><h1>404</h1><p>Esta página no existe o fue movida. Puedes volver al inicio para encontrar lo que necesitas.</p><a href="/">Volver al inicio</a></div></body></html>`);
    }
  });
}
