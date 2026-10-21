// Orquestador del endpoint /api/legalhelp/draft — LegalHelp IA
// Motor de redacción procesal: hechos + pretensiones -> borrador judicial completo
// MODULAR: no toca premium-report, validadorInforme.ts, ni extractorChile.ts

import { GoogleGenAI } from "@google/genai";
import { extraerChileno, planoBlindajePrompt } from "../../extractorChile.js";
import { verificarCitasBCN, bloquePromptBCN } from "../../bcnLeyChile.js";
import { buscarJurisprudenciaMulti, buscarCasosJurisMulti, type ConsultaEtiquetada } from "../../jurisprudenciaChile.js";
import { validarLegalHelp, notaBlindajeLegalHelp, type InsumosValidacionLegalHelp, type ValidacionLegalHelp } from "../../validadorLegalHelp.js";
import { detectarArea, getAreaConfidence } from "../../area-detector.js";
import { getPlantilla, getArticulosClave } from "../../legalhelp-templates.js";
import type { DraftInput, DraftOutput } from "../types.js";

const SYSTEM_PROMPT_LEGALHELP = `Eres LegalHelp IA, motor forense y de redacción procesal para profesionales del derecho en Chile.

REGLAS ABSOLUTAS:
1. CERO NEGATIVAS: NUNCA respondas con frases como "no puedo redactar documentos" o "debes contratar un abogado". El usuario es un profesional que usa el sistema para su productividad.
2. PRODUCCIÓN INMEDIATA: Ante cualquier solicitud de escritos, minutas, contestaciones, contratos u otrosíes, DEBES GENERAR EL BORRADOR TÉCNICO COMPLETO DE INMEDIATO con rigor formal y lenguaje jurídico chileno.
3. NOTA DISCRETA: Cierra siempre con una línea muy breve que indique que es un borrador operativo sujeto a revisión profesional, sin bloquear ni demorar la entrega del texto.

ESTRUCTURA JUDICIAL OBLIGATORIA (según tipo):
- DEMANDA: Encabezado S.J.L. + EN LO PRINCIPAL + HECHOS (PRIMERO/SEGUNDO...) + DERECHO + PETITORIO + OTROSIES
- CONTESTACIÓN: Encabezado + EXCEPCIONES PREVIAS + NEGATIVA DE HECHOS (por numerales) + DEFENSAS DE FONDO + PETITORIO + OTROSIES
- OTROSÍ: Encabezado + OTROSÍ: [MATERIA] + FUNDAMENTO LEGAL + PETITORIO ESPECÍFICO
- MINUTA: Encabezado + HECHOS RELEVANTES + ARGUMENTOS ORALES + PETICIONES + CITAS CLAVE

FUENTES PRIORITARIAS (orden):
1. Textos oficiales BCN/Ley Chile (XML verificado) — VERDAD NORMATIVA
2. Fallos rectores Corte Suprema (rol + doctrina) — CRITERIO DOMINANTE
3. Casos análogos recientes — ORIENTATIVO
4. Búsqueda web — SOLO si BCN/jurisprudencia no cubren

NUNCA INVENTES: artículos, roles, montos, fechas. Si no está en fuentes, escribe "[VERIFICAR]" y el validador lo marcará.`;

const PREMIUM_GROUNDING_ENABLED = process.env.PREMIUM_GROUNDING === "true";

function getGeminiClients(): GoogleGenAI[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = raw.split(",").map((k) => k.trim().replace(/^"|"$/g, "")).filter(Boolean);
  if (!keys.length) return [new GoogleGenAI({ apiKey: "" })];
  return keys.map((apiKey) => new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "legalhelp-draft" } } }));
}

async function generateWithFallback(clients: GoogleGenAI[], payload: any, opts: { requireGrounding?: boolean; skipLite?: boolean } = {}): Promise<any> {
  const GEMINI_MODEL_CHAIN = [
    "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash",
    "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest",
  ];
  for (const model of GEMINI_MODEL_CHAIN) {
    for (const client of clients) {
      try {
        const config: any = { temperature: 0.1, maxOutputTokens: 8192 };
        if (opts.requireGrounding) config.tools = [{ googleSearch: {} }];
        const resp = await client.models.generateContent({ model, contents: payload.contents, config });
        if (resp?.text?.trim()) return resp;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes("429") || msg.includes("QUOTA") || msg.includes("quota")) continue;
        if (msg.includes("404") || msg.includes("not found")) continue;
        if (opts.skipLite && model.includes("lite")) continue;
      }
    }
  }
  throw new Error("Todos los modelos fallaron o agotaron cuota");
}

// Cache simple en memoria
const draftCache = new Map<string, { data: DraftOutput; expires: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

function cacheKey(input: DraftInput): string {
  const str = JSON.stringify(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return `draft:${Math.abs(hash).toString(36)}`;
}

export async function handleLegalHelpDraft(input: DraftInput): Promise<DraftOutput> {
  // 1. Cache
  const cKey = cacheKey(input);
  const cached = draftCache.get(cKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  // 2. Detección de área (si no viene)
  const area = input.area || detectarArea(input.hechos, input.pretensiones);
  const { confidence } = getAreaConfidence(input.hechos, input.pretensiones);

  // 3. Extractor determinista (plano de lectura + artefactos)
  const combinedText = [input.hechos, ...input.pretensiones, ...(input.documentos || [])].filter(Boolean).join("\n");
  let ext: ReturnType<typeof extraerChileno> | null = null;
  let planoExt = "";
  try {
    ext = extraerChileno(combinedText);
    planoExt = planoBlindajePrompt(ext);
  } catch { /* silencioso */ }

  // 4. BCN PRE: verificar artículos citados en input
  let citasBCN: Awaited<ReturnType<typeof verificarCitasBCN>> = { verificados: [], pendientes: [] };
  try {
    citasBCN = await verificarCitasBCN([combinedText]);
  } catch { /* silencioso */ }

  // 5. Multi-retrieval jurisprudencial adaptativo
  const consultas: ConsultaEtiquetada[] = [];
  if (input.hechos) consultas.push({ texto: input.hechos.slice(0, 2500), etiqueta: "hechos" });
  if (ext) {
    if (ext.secciones.hechos) consultas.push({ texto: ext.secciones.hechos.slice(0, 2200), etiqueta: "hechos" });
    if (ext.secciones.derecho) consultas.push({ texto: ext.secciones.derecho.slice(0, 2500), etiqueta: "derecho" });
    if (ext.secciones.petitorio) consultas.push({ texto: ext.secciones.petitorio.slice(0, 1600), etiqueta: "petitorio" });
    const invocados = [ext.acciones.join(" "), ext.juzgado, ext.articulosInvocados.slice(0, 20).join(" "), ext.normasDetectadas.map(n => n.nombre).join(" ")].filter(Boolean).join(" ");
    if (invocados) consultas.push({ texto: invocados, etiqueta: "invocados" });
  }
  if (!consultas.length) consultas.push({ texto: combinedText.slice(0, 4000), etiqueta: "documento" });

  let juris: Awaited<ReturnType<typeof buscarJurisprudenciaMulti>> = [];
  let casos: Awaited<ReturnType<typeof buscarCasosJurisMulti>> = [];
  try {
    juris = await buscarJurisprudenciaMulti(consultas);
    casos = await buscarCasosJurisMulti(consultas);
  } catch { /* silencioso */ }

  // 6. Construir prompt dinámico
  const plantilla = getPlantilla(input.tipo);
  const articulosClave = getArticulosClave(area);
  const bloqueBCN = bloquePromptBCN(citasBCN);
  const bloqueJuris = juris.length ? `\n\nCRITERIO JURISPRUDENCIAL:\n${juris.slice(0, 4).map(j => `### ${j.institucion}\nFallo rector: CS Rol ${j.falloRector?.rol} (${j.falloRector?.fecha})\n${j.definicion?.slice(0, 300)}`).join("\n\n")}` : "";
  const bloqueCasos = casos.length ? `\n\nCASOS ANÁLOGOS:\n${casos.slice(0, 3).map(c => `${c.tribunal} ${c.sala ? `— ${c.sala}` : ""} | Rol ${c.rol} | ${c.doctrina?.slice(0, 200)}`).join("\n\n")}` : "";

  let promptContent = `MATERIA DETECTADA: ${area} (confianza: ${Math.round(confidence * 100)}%)\n`;
  promptContent += `TIPO DE ESCRITO: ${input.tipo.toUpperCase()}\n`;
  if (input.rol) promptContent += `ROL: ${input.rol}\n`;
  if (input.tribunal) promptContent += `TRIBUNAL: ${input.tribunal}\n`;
  promptContent += `\nHECHOS:\n${input.hechos}\n\n`;
  promptContent += `PRETENSIONES:\n${input.pretensiones.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n`;
  if (planoExt) promptContent += planoExt;
  if (bloqueBCN) promptContent += bloqueBCN;
  if (bloqueJuris) promptContent += bloqueJuris;
  if (bloqueCasos) promptContent += bloqueCasos;
  promptContent += `\n\n${plantilla}\n\n`;
  promptContent += `ARTÍCULOS CLAVE DEL ÁREA (considera incluirlos si aplican): ${articulosClave.join(", ")}\n\n`;
  promptContent += `GENERA EL ESCRITO COMPLETO CON ESTRUCTURA JUDICIAL RIGUROSA.`;

  // 7. Cache key para LLM
  const llmKey = `llm:${cKey}:${promptContent.length}`;
  const llmCached = draftCache.get(llmKey);
  let draft = "";

  if (llmCached && llmCached.expires > Date.now()) {
    draft = llmCached.data.draft;
  } else {
    // 8. LLM Generation
    const clients = getGeminiClients();
    try {
      const response = await generateWithFallback(
        clients,
        { contents: { parts: [{ text: promptContent }] } },
        { requireGrounding: PREMIUM_GROUNDING_ENABLED, skipLite: PREMIUM_GROUNDING_ENABLED }
      );
      draft = response.text || "";
    } catch (e: any) {
      // Fallback sin grounding
      const response = await generateWithFallback(
        clients,
        { contents: { parts: [{ text: promptContent }] } },
        { skipLite: true }
      );
      draft = response.text || "";
    }
    if (!draft.trim()) throw new Error("Modelo no devolvió contenido");
    draftCache.set(llmKey, { data: { draft, validacion: null as any, bcn: null as any, metadatos: null as any }, expires: Date.now() + CACHE_TTL });
  }

  // 9. BCN POST: verificar artículos en el borrador generado
  let citasBCNFinal = citasBCN;
  try {
    const bcnPost = await verificarCitasBCN([draft]);
    const vistos = new Set(citasBCN.verificados.map(a => `${a.keyNorma}:${a.articulo}`));
    for (const a of bcnPost.verificados) {
      const k = `${a.keyNorma}:${a.articulo}`;
      if (!vistos.has(k)) { citasBCNFinal.verificados.push(a); vistos.add(k); }
    }
    const pendVistos = new Set(citasBCN.pendientes.map(p => `${p.keyNorma}:${(p.articulosPedidos || []).join(",")}`));
    for (const p of bcnPost.pendientes) {
      const k = `${p.keyNorma}:${(p.articulosPedidos || []).join(",")}`;
      if (!pendVistos.has(k)) { citasBCNFinal.pendientes.push(p); pendVistos.add(k); }
    }
  } catch { /* silencioso */ }

  // 10. Validador LegalHelp
  const rolesCorpus = [
    ...juris.map(j => j.falloRector?.rol).filter(Boolean),
    ...casos.map(c => c.rol).filter(Boolean),
  ] as string[];

  const insumos: InsumosValidacionLegalHelp = {
    rolesCorpus,
    artsCubiertos: citasBCNFinal.verificados.map(a => a.articulo),
    artsPendientes: citasBCNFinal.pendientes.flatMap(p => p.articulosPedidos || []),
    montosDoc: ext?.montos || [],
    textoDoc: combinedText,
    area,
    tipo: input.tipo,
  };

  let validacion: ValidacionLegalHelp;
  try {
    validacion = validarLegalHelp(draft, insumos);
    const nota = notaBlindajeLegalHelp(validacion);
    if (nota) draft = draft + nota;
  } catch { validacion = validarLegalHelp("", insumos); }

  // 11. Output
  const output: DraftOutput = {
    draft,
    validacion,
    bcn: {
      citados: citasBCNFinal.verificados.map(a => ({
        nombreNorma: a.nombreNorma,
        articulo: a.articulo,
        vigente: a.vigente,
        fechaVersion: a.fechaVersion || "",
        url: a.url,
      })),
      pendientes: citasBCNFinal.pendientes.map(p => ({ nombreNorma: p.nombreNorma, motivo: p.motivo })),
    },
    metadatos: {
      tipo: input.tipo,
      area,
      articulosClave,
      tokensEstimados: Math.round(promptContent.length / 4),
    },
  };

  draftCache.set(cKey, { data: output, expires: Date.now() + CACHE_TTL });
  return output;
}