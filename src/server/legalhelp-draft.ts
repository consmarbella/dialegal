// Orquestador del endpoint /api/legalhelp/draft — LegalHelp IA
// Motor de redacción procesal: hechos + pretensiones -> borrador judicial completo
// MODULAR: no toca premium-report, validadorInforme.ts, ni extractorChile.ts

import { GoogleGenAI } from "@google/genai";
import { extraerChileno, planoBlindajePrompt } from "../../extractorChile.js";
import { verificarCitasBCN, bloquePromptBCN } from "../../bcnLeyChile.js";
import { buscarJurisprudenciaMulti, buscarCasosJurisMulti, type ConsultaEtiquetada } from "../../jurisprudenciaChile.js";
import { validarLegalHelp, notaBlindajeLegalHelp, type InsumosValidacionLegalHelp, type ValidacionLegalHelp } from "../../validadorLegalHelp.js";
import { auditarVacios } from "../../auditorVacios.js";
import { detectarArea, getAreaConfidence } from "../../area-detector.js";
import { getPlantilla, getArticulosClave } from "../../legalhelp-templates.js";
import type { DraftInput, DraftOutput, VacioCritico } from "../types.js";

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

NUNCA INVENTES: artículos, roles, montos, fechas NI IDENTIDADES de las partes. Los nombres de demandante, representantes y apoderados deben provenir del [DOCUMENTO DEL CASO] o del [DICTAMEN TÉCNICO PREVIO]. Si un nombre no figura en ellos, redáctalo de forma neutra ("el actor", "la demandada") o usa el marcador "[NOMBRE DEL ACTOR]"; jamás un apellido supuesto.
MARCADOR ÚNICO DE DATOS OPERATIVOS FALTANTES: si un dato indispensable (RIT/RUC, fecha de notificación, nombre o patente de abogado, RUN de testigo, escritura de poder, etc.) NO figura en ninguna fuente, escribe en el lugar exacto del escrito el marcador "[DATO FALTANTE: descripción corta]" (p. ej. "RIT C-[DATO FALTANTE: rol de la causa]-2026", "notificada el [DATO FALTANTE: fecha de notificación de la demanda]"). Nunca dejes espacios en blanco vacíos ni "XX"; cada marcador se convierte en una pregunta para el usuario. "[VERIFICAR]" queda reservado SOLO para citas normativas sin cobertura BCN.

JERARQUÍA DE CONTEXTO DEL CASO (cuando el prompt incluya estos bloques, prevalecen sobre ejemplos genéricos):
1. [DOCUMENTO DEL CASO] — texto real del expediente: fuente principal de HECHOS, FECHAS y MONTOS. Cítalos literalmente; no los sustituyas por supuestos.
2. [DICTAMEN TÉCNICO PREVIO] — análisis del mismo caso: fuente principal de la ESTRATEGIA. No contradigas sus conclusiones; nuestros criterios legales (BCN/jurisprudencia) los respaldan.
3. BCN/Ley Chile y jurisprudencia — verificación normativa.
4. Plantilla — da la FORMA, nunca inventa contenido.

CALIDAD FORENSE OBLIGATORIA (aplica a todo borrador con documento/dictamen adjunto):
- NEGATIVAS/AFIRMACIONES PUNTUALES: cuando sea contestación/defensa, niega hechos y rebate cada pretensión demandada una por una (por numeral o rubro), con su razón de improcedencia. Nunca una negativa global sola.
- EXCEPCIONES A MEDIDA: opón solo las que el caso concreto haga procedentes, fundadas en el documento/dictamen; nada de excepciones por rutina ni contradictorias con la propia posición del caso.
- CITAS DE LA CONTRAPARTE: los roles, causales y montos que solo aparezcan como citas del demandante NO son del propio caso; jamás los uses como si fueran propios (especialmente en el encabezado RIT/RUC).
- DATOS HEREDADOS: usa exactamente los montos, plazos y conseciones del documento/dictamen; si faltan, usa "[DATO FALTANTE: qué dato falta]". El borrador debe individualizar las FECHAS EXTREMAS del vínculo (inicio y término, tal como constan en el [DOCUMENTO DEL CASO], p. ej. "4 de abril de 2022 … 15 de diciembre de 2024"), los MONTOS reclamados y el tribunal/rol del encabezado; no las omitas ni las aproximes.
- VOCABULARIO DE QA: los marcadores de trazabilidad ("NO VERIFICADO", "no corroborado", "pendiente de confirmar") NO pertenecen al texto del escrito. Todo dato que SÍ figure en el documento/dictamen se afirma directamente como hecho del expediente; los marcadores se reservan solo para datos ausentes en todas las fuentes.
- TRIBUNAL Y ROL: el TRIBUNAL y el ROL/RIT proporcionados en el encabezado (si existen) se reproducen LITERALMENTE, sin renombrarlos, sin numerarlos ni añadir servidores/puertas (1°, N° 2); si no fueron proporcionados, usa el marcador de dato faltante ("S.J.L. de [DATO FALTANTE: comuna del tribunal]", "RIT: [DATO FALTANTE: rol de la causa]").
- REGENERACIÓN CON DATOS DEL USUARIO: si el prompt incluye el bloque [DATOS COMPLETADOS POR EL USUARIO], INTEGRÁELOS en el borrador tal como los dio el usuario (exactos, con formato procesal) y ELIMINA los marcadores "[DATO FALTANTE]" y "[NOMBRE ...]" correspondientes; no los dejes ambos (dato + marcador).
- ROLES DE FALLOS JURISPRUDENCIALES: PROHIBIDO citar un rol de fallo (ej. "Rol N° 41.500-2017") que NO aparezca en los bloques verificados (CRITERIO JURISPRUDENCIAL / CASOS ANÁLOGOS / [DICTAMEN]). Cita la doctrina sin rol (" según la jurisprudencia de la Excma. Corte Suprema"); si la fuente trae un rol, cópialo textual. Los roles citados por la contraparte solo se mencionan como citas de ella, nunca como propios.`;

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

// Des-escapa corchetes que el modelo a veces emite en markdown (\[X\] → [X]),
// para que encabezado, copiado y auditor de vacíos vean los marcadores reales.
function limpiarEscapesCorchetes(t: string): string {
  return t.replace(/\\([\[\]])/g, "$1");
}

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
  // El documento real del expediente entra primero: los montos/fechas que extrae
  // el extractor y el validador QA corresponden al caso, no a resúmenes.
  const combinedText = [input.documentoCaso, input.hechos, ...input.pretensiones, ...(input.documentos || [])]
    .filter(Boolean)
    .join("\n");
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
  if (input.documentoCaso) consultas.push({ texto: input.documentoCaso.slice(0, 2500), etiqueta: "documento" });
  if (input.dictamen) consultas.push({ texto: input.dictamen.slice(0, 2500), etiqueta: "dictamen" });
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
  // Bloques de contexto heredado (Motor v2): documento real + dictamen del caso.
  // Van antes de la plantilla para que fijen hechos/estrategia y la plantilla solo dé forma.
  if (input.documentoCaso) {
    promptContent += `\n[DOCUMENTO DEL CASO] — texto real del expediente; HECHOS, FECHAS y MONTOS autoritativos:\n${input.documentoCaso.slice(0, 9000)}\n`;
  }
  if (input.dictamen) {
    promptContent += `\n[DICTAMEN TÉCNICO PREVIO] — análisis del mismo caso; ESTRATEGIA y defensas conforme al diagnóstico:\n${input.dictamen.slice(0, 9000)}\n`;
  }
  if (input.respuestasAuditoria?.trim()) {
    promptContent += `\n[DATOS COMPLETADOS POR EL USUARIO] — respuestas a la auditoría de vacíos de una versión anterior del borrador. Insértalas en su lugar exacto (RIT, techo de notificación, patrocinante, testigos, etc.), con la ortografía y detalle que el usuario entregó, y ELIMINA los marcadores que reemplazan:\n${input.respuestasAuditoria.slice(0, 4000)}\n`;
  }
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
    draft = limpiarEscapesCorchetes(llmCached.data.draft);
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
    draft = limpiarEscapesCorchetes(draft);
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

  // 10.5 Auditoría determinista de vacíos críticos (Fase 2)
  let vacios: VacioCritico[] = [];
  try {
    vacios = auditarVacios(draft, input);
  } catch { /* silencioso */ }

  // 11. Output
  const output: DraftOutput = {
    draft,
    validacion,
    vacios,
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