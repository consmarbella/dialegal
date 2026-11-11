// Orquestador del endpoint /api/legalhelp/draft — LegalHelp IA
// Motor de redacción procesal: hechos + pretensiones -> borrador judicial completo
// MODULAR: no toca premium-report, validadorInforme.ts, ni extractorChile.ts

import { GoogleGenAI } from "@google/genai";
import { extraerChileno, planoBlindajePrompt } from "../../extractorChile.js";
import { verificarCitasBCN, bloquePromptBCN } from "../../bcnLeyChile.js";
import { buscarJurisprudenciaMulti, buscarCasosJurisMulti, type ConsultaEtiquetada } from "../../jurisprudenciaChile.js";
import { validarLegalHelp, notaBlindajeLegalHelp, type InsumosValidacionLegalHelp, type ValidacionLegalHelp } from "../../validadorLegalHelp.js";
import { auditarVacios } from "../../auditorVacios.js";
import { lineaMateriaPrompt, MATERIAS } from "../../materias.js";
import { decidirMateria } from "./materiaDecision.js";
import { ejecutarPipelinePrevio } from "./pipelineLegalHelp.js";
import { existePlazo, calcularPlazo, detectarFechaNotificacion, detectarFechasNotificacion, anotacionesPlazos, bloquePromptPlazos, chequearPlazosEnBorrador, sanitizarAfirmacionPlazoVencido, type ResultadoPlazo, type FechasNotificacionResultado } from "../../plazosChile.js";
import { getPlantilla, getArticulosClave } from "../../legalhelp-templates.js";
import { lintTactico as lintTacticoBorrador, notaTactica } from "../../lintTactico.js";
import { lintTacticoProcesal, sanitizarTactico } from "../../lintTacticoLegalHelp.js";
import type { DraftInput, DraftOutput, VacioCritico, HallazgoTactico } from "../types.js";
// Fase I.5: Núcleo tipado (LLM-primary) detrás de NUCLEO_TIPADO=true.
import { extraerCaso, type Caso } from "./extraerCaso.js";
import { decidirVia, type DecisionVia, CATALOGO, materiaTieneCatalogo } from "./viasProcesales.js";
// Fase 1: generateWithFallback consolidado en llmEngine.ts (versión completa:
// cadena dinámica, pausa por cuota diaria, reintentos y fallback degradado).
// Se importa aquí para eliminar la copia simplificada de este módulo.
import { generateWithFallback } from "./llmEngine.js";

const SYSTEM_PROMPT_LEGALHELP = `Eres LegalHelp IA, motor forense y de redacción procesal para profesionales del derecho en Chile.

REGLAS ABSOLUTAS:
1. CERO NEGATIVAS: NUNCA respondas con frases como "no puedo redactar documentos" o "debes contratar un abogado". El usuario es un profesional que usa el sistema para su productividad.
2. PRODUCCIÓN INMEDIATA: Ante cualquier solicitud de escritos, minutas, contestaciones, contratos u otrosíes, DEBES GENERAR EL BORRADOR TÉCNICO COMPLETO DE INMEDIATO con rigor formal y lenguaje jurídico chileno.
3. NOTA DISCRETA: Cierra siempre con una línea muy breve que indique que es un borrador operativo sujeto a revisión profesional, sin bloquear ni demorar la entrega del texto.
4. POSTURA VINCULANTE: redactas EXCLUSIVAMENTE por la parte indicada en POSTURA PROCESAL (demandante o demandado); si no viene indicada, la fija el TIPO DE ESCRITO (DEMANDA=demandante, CONTESTACIÓN=demandado) y queda prohibido cambiar de vereda. Fórmulas de la vereda contraria PROHIBIDAS: en una demanda, "mi representada se allana", "excepciones previas", "negativa de hechos", "defensas de fondo", "se niega que el actor"; en una contestación, "vengo en demandar", "solicito se condene a la demandada".
5. LEY BUSTOS — PROHIBIDO PROMETER PAGOS: nunca escribas que la parte "ha procedido o procederá" a la regularización o pago, ni "con el objeto de convalidar el despido", ni "una vez pagadas las cotizaciones", ni "se regularizarán/pagarán/enterarán". Solo dos salidas:
   a) Si el expediente acredita pago íntegro Y notificación (fecha cierta + prueba): "La nulidad del despido se encuentra íntegramente convalidada con fecha [X], mediante pago íntegro de las cotizaciones adeudadas y notificación fehaciente al trabajador y a la Inspección del Trabajo, por lo que la sanción carece de objeto actual."
   b) Si NO consta: niega el presupuesto ("Se niega que las cotizaciones previsionales se encontraran impagas al momento del despido") y exige a la contraria acreditarlo con certificados de cotización y registros de la AFP/institución; NO reconozcas impago NI prometas pago. Si el propio relato reconoce cotizaciones impagas al despido, esa regularización JAMÁS se escribe en el escrito: usa la rama (b).
6. ALLANAMIENTO PROHIBIDO "POR SI ACASO": nunca te allanes en abstracto ("se allana al pago de las sumas que pudieren corresponder", "si es que existiere algún saldo", "en cuanto pudiere adeudar", "por si acaso"). Solo reconoce sumas líquidas, ciertas e indiscutidas, identificadas por monto y concepto. Para feriado: "Se niega que el actor mantenga saldo alguno por concepto de feriado proporcional y/o legal, debiendo este acreditar fehacientemente mediante liquidaciones y registros que prestó servicios efectivos sin hacer uso de su feriado legal durante los períodos reclamados." Si el expediente contiene finiquito o liquidaciones que cubren el feriado, cítalos por fecha y monto.
7. CONVALIDACIÓN: solo en PASADO y con fecha + prueba; jamás como finalidad ("con el objeto de convalidar") ni en futuro.

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
2. [DICTAMEN TÉCNICO PREVIO] — SOLO si viene en el prompt y el escrito NO es contestación: orienta estrategia. En CONTESTACIÓN está PROHIBIDO usar diagnóstico orientativo como estrategia (contamina con tesis del actor). En contestación: documento + pretensiones del usuario + BCN/jurisprudencia. En todo caso el dictamen NUNCA cambia tu POSTURA (regla 4): si viene de la vereda contraria, úsalo para anticipar y rebatir, no para adoptar sus fórmulas.
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
- ROLES DE FALLOS JURISPRUDENCIALES: PROHIBIDO citar un rol de fallo (ej. "Rol N° 41.500-2017") que NO aparezca en los bloques verificados (CRITERIO JURISPRUDENCIAL / CASOS ANÁLOGOS / [DICTAMEN]). Cita la doctrina sin rol ("según la jurisprudencia de la Excma. Corte Suprema"); si la fuente trae un rol, cópialo textual. Los roles citados por la contraparte solo se mencionan como citas de ella, nunca como propios.
D) PROCEDIMIENTO MONITORIO DE ARRENDAMIENTO (Ley N° 18.101 modificada por Ley N° 21.461):
  1) El plazo para pagar o formular oposición es de 10 DÍAS CORRIDOS desde la notificación (Arts. 18-C y 18-F Ley 18.101), NO los 18 días hábiles del juicio ordinario.
  2) El escrito del demandado es OPOSICIÓN FUNDADA A LA DEMANDA MONITORIA (Arts. 18-F y 18-H Ley 18.101; Art. 309 CPC en lo supletorio). PROHIBIDO citar el Art. 254 del CPC (requisitos de la demanda) como fundamento de una contestación u oposición.
  3) En el petitorio NO pidas "denegar la solicitud de requerimiento de pago" (ya fue dictado); pide tener por interpuesta oposición fundada a la demanda monitoria, declarar terminado el procedimiento monitorio dejando sin efecto de pleno derecho la resolución del Art. 18-C (conforme al Art. 18-H de la Ley 18.101) y rechazar el cobro en lo que exceda lo efectivamente adeudado, sin lugar al lanzamiento.
  4) OTROSÍ OBLIGATORIO DE MEDIOS DE PRUEBA (Art. 18-F inc. 1° Ley 18.101): además de acompañar los documentos, incluye SIEMPRE un otrosí donde señales expresamente TODOS los demás medios de prueba de que te valdrás en el juicio declarativo posterior (instrumental, testimonial, confesional, informe de peritos e inspección personal del tribunal).
  5) Cita con precisión el Art. 1924 del Código Civil: N° 1 = entregar la cosa; N° 2 = mantenerla en estado de servir para el fin arrendado (reparaciones/filtraciones); N° 3 = librar al arrendatario de turbaciones o embarazos en el goce.
- COHERENCIA DEL PETITORIO: si en el cuerpo del escrito se reconoce un pago parcial o un saldo insoluto menor, el petitorio debe pedir acoger la oposición y rechazar la demanda en todo lo que exceda la suma reconocida (y en subsidio tener por reconocida únicamente esa suma), sin contradecirse.
- SOBRIEDAD FORENSE Y PLAZOS VENCIDOS: prohibido usar calificativos agresivos ("maliciosamente exigidos", "manifiesta falta de fundamento") o giros erróneos ("de manera íntegra e imprevista" → usa "íntegra y oportuna"; escribe "adeudo/adeudar", jamás "adude"). Si el PLAN DE PLAZOS marca PLAZO VENCIDO, queda PROHIBIDO escribir "encontrándome dentro de plazo legal" o "en tiempo y forma".

REGLAS DE ORO PROCESALES CHILENAS (OBLIGATORIAS EN CONTESTACIÓN / DEFENSA LABORAL):

A) LEY BUSTOS / ART. 162 CT — MORA PREVISIONAL:
- PROHIBIDO redactar promesas o futuros: "procederá a pagar", "se regularizarán las cotizaciones", "una vez pagadas se convalida", "el empleador se compromete a enterar".
- El tratamiento es BINARIO y solo con base en el [DOCUMENTO DEL CASO] / [DICTAMEN]:
  (1) Si consta pago Y notificación al trabajador ANTES del término: alegar convalidación efectiva con FECHA exacta y prueba; o
  (2) Si NO consta: NEGAR que la eventual mora prive de efectos al despido, negar perjuicio, y exigir al actor la carga de acreditar mora, monto, periodo y nexo causal. NUNCA ofrecer regularización futura en el escrito.

B) FERIADO LEGAL Y HORAS EXTRAORDINARIAS:
- PROHIBIDO allanarse "por si acaso" o en condicional: "si existiere saldo", "si resultare diferencia", "se pagará lo que corresponda", "sin perjuicio de liquidar feriado".
- Debe NEGARSE CATEGÓRICAMENTE la existencia de saldo pendiente por feriado y/o horas extraordinarias, salvo que el [DOCUMENTO DEL CASO] reconozca un monto líquido y exigible.
- Trasladar expresamente la CARGA PROBATORIA al demandante (existencia, liquidación, no pago).

C) Si el caso no es laboral, ignora A y B. Si es laboral y el rubro no fue demandado, no lo introduzcas.`;

// Fase 1: las dos banderas de grounding son DISTINTAS por diseño y no deben
// unificarse ni renombrarse sin tocar Vercel:
// - PREMIUM_GROUNDING_ENABLED (server.ts): gate del endpoint /api/premium-report
//   (está en true en Vercel -> capa premium activa).
// - PREMIUM_GROUNDING (este módulo): si el BORRADOR exige googleSearch.
//   NO está definida en Vercel -> los borradores corren sin búsqueda web
//   (más rápidos, gastan menos cuota). Se conserva el comportamiento actual
//   a propósito: fusionarlas o encenderlas por accidente subiría latencia,
//   costo y consumo de cuota de todos los borradores.
const PREMIUM_GROUNDING_ENABLED = process.env.PREMIUM_GROUNDING === "true";

function getGeminiClients(): GoogleGenAI[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = raw.split(",").map((k) => k.trim().replace(/^"|"$/g, "")).filter(Boolean);
  if (!keys.length) return [new GoogleGenAI({ apiKey: "" })];
  return keys.map((apiKey) => new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "legalhelp-draft" } } }));
}

// Fase 1: (generateWithFallback importado arriba desde llmEngine.ts).

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

// ── Fase 7: mapeo tipo/area -> plazo registrado y calculo determinista ────
const PLAZO_POR_TIPO: Record<string, { id: string; aplica: ("demanda" | "contestacion" | "minuta")[] }> = {
  civil: { id: "civil_contestacion", aplica: ["contestacion"] },
  // Fase E: sin entrada laboral — el CT vigente no fija plazo de contestación
  // (audiencia preparatoria, CT 451/452): los drafts laborales reciben la nota
  // [VERIFICACION DE PLAZOS] en vez de una fecha inventada.
};
export function resolverPlazoIdCivilContestacion(texto: string): string | null {
  // "monitoria" (forma usual en el escrito) y "monitorio" (adjetivo del procedimiento).
  // Antes solo "monitorio": en prod un escrito de demanda monitoria calculaba 18 días
  // hábiles en vez de 10 corridos y no detectaba el plazo vencido.
  if (/\bmonitori[oa]s?\b/i.test(texto) && /(?:arrendamiento|arriendo|18\.?\s?101|21\.?\s?461|renta)/i.test(texto)) {
    return "civil_monitorio_arrendamiento";
  }
  if (/\b(?:juicio\s+ejecutivo|demanda\s+ejecutiva|mandamiento\s+de\s+ejecuci[oó]n|art(?:[íi]culos?|s?\.?)\s*46[24])\b/i.test(texto)) {
    return "civil_ejecutivo_oposicion";
  }
  if (/\b(?:procedimiento\s+sumario|juicio\s+sumario|art(?:[íi]culos?|s?\.?)\s*68[03])\b/i.test(texto)) {
    return null; // sumario no usa los 18 días del juicio ordinario; se abstiene con [VERIFICAR]
  }
  return "civil_contestacion";
}

function calcularPlazosMotor(area: string | null, tipo: string, combinedText: string, fechasRes?: { primera: string | null }): ResultadoPlazo[] {
  const def = area ? PLAZO_POR_TIPO[area] : undefined;
  if (!def || !def.aplica.includes(tipo as any)) return [];
  const plazoId = area === "civil" && tipo === "contestacion"
    ? resolverPlazoIdCivilContestacion(combinedText)
    : def.id;
  if (!plazoId || !existePlazo(plazoId)) return [];
  // Calibración gate: fechasRes viene pre-detectado por el llamador
  // (detectarFechasNotificacion) para reutilizarlo también en anotaciones.
  const fecha = fechasRes ? fechasRes.primera : detectarFechaNotificacion(combinedText);
  if (!fecha) return [];
  const r = calcularPlazo({ plazoId, fechaNotificacion: fecha });
  return r.ok ? [r] : [r];
}

export async function handleLegalHelpDraft(input: DraftInput): Promise<DraftOutput> {
  // 1. Cache
  const cKey = cacheKey(input);
  const cached = draftCache.get(cKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  // 2. Materia que gobierna el caso (Fase D) — se resuelve DESPUÉS de armar
  // combinedText para que el clasificador vea todo el relato. Regla del dueño:
  // el área declarada MANDA; las señales solo sugieren; sin señal = null
  // (indeterminada, NUNCA "laboral" por defecto — causa raíz de la
  // contaminación civil→laboral del informe real). Conflicto = anotación
  // visible, jamás bloqueo.
  // Contestación/otrosí: el dictamen orientativo NO se usa (contaminaba la defensa).
  const esDefensaEscrita = input.tipo === "contestacion" || input.tipo === "otrosi";
  const dictamenUtil = esDefensaEscrita ? undefined : input.dictamen;
  const combinedText = [input.documentoCaso, input.hechos, ...input.pretensiones, ...(input.documentos || [])]
    .filter(Boolean)
    .join("\n");
  // ── Fase I.5: Núcleo tipado (LLM-primary) detrás de NUCLEO_TIPADO=true ──
  // Con el flag apagado no se importa ni se ejecuta este módulo (rollback instantáneo).
  const NUCLEO_TIPADO = process.env.NUCLEO_TIPADO === "true";
  let caso: Caso | null = null;
  let decision: DecisionVia | null = null;
  let bloqueViaProcesal = "";
  if (NUCLEO_TIPADO) {
    const { caso: c, advertencias } = await extraerCaso(getGeminiClients(), combinedText);
    caso = c;
    if (caso) {
      decision = decidirVia(caso);
      // Fase I.5 (corrección de riesgo): CATALOGO solo tiene vías civiles. Si la
      // materia no tiene catálogo, NO retornar: continuar con el flujo actual
      // completo (como si el flag estuviera apagado para ese caso). Solo retornar
      // preguntas cuando la materia sí tiene catálogo y el estado lo requiere.
      const tieneCatalogo = materiaTieneCatalogo(caso.materia);
      const preguntasDecision =
        decision.estado === "requiere_datos" || decision.estado === "sin_via"
          ? (decision as { preguntas: string[] }).preguntas
          : [];
      const debeRetornarPreguntas =
        tieneCatalogo &&
        (decision.estado === "requiere_datos" ||
          (decision.estado === "sin_via" && preguntasDecision.length > 0));
      if (debeRetornarPreguntas) {
        // Devolver preguntas al usuario como VacioCritico, sin generar borrador todavía.
        const vacios: VacioCritico[] = preguntasDecision.map((p, i) => ({
          campo: `via-${i}`,
          prioridad: 'fatal',
          pregunta: p,
          fragmento: undefined,
        }));
        const insumosVacios: InsumosValidacionLegalHelp = {
          rolesCorpus: [], artsCubiertos: [], artsPendientes: [], montosDoc: [],
          textoDoc: combinedText, area: null, tipo: input.tipo,
        };
        return {
          draft: "",
          validacion: validarLegalHelp("", insumosVacios),
          vacios,
          bcn: { citados: [], pendientes: [] },
          metadatos: {
            tipo: input.tipo, area: null, articulosClave: [], tokensEstimados: 0,
            audience: input.audience || "abogado",
          },
        } as DraftOutput;
      }
      // Si no tiene catálogo (o sin_via sin preguntas): continuar con flujo actual.
      // Asegurar que no se inyecte bloque de vía procesal en el prompt.
      if (!tieneCatalogo) {
        bloqueViaProcesal = "";
      }
      // "decidida": bloque [VÍA PROCESAL DECIDIDA] reemplaza bloqueSubsuncion + planoExt.
      const viaDef = CATALOGO.find((v) => v.id === decision.via);
      if (viaDef) {
        const normasBase = viaDef.normasBase.join(", ");
        const hechosResumen = [...caso.hechos.map((h) => h.descripcion), ...caso.pretensiones.map((p) => p.descripcion)].join("; ");
        bloqueViaProcesal = `\n\n[VÍA PROCESAL DECIDIDA]\nVía: ${viaDef.nombre}\nNormas base: ${normasBase}\nHechos tipados: ${hechosResumen.slice(0, 2000)}\n`;
      }
    }
  }
  // Pipeline ①②③⑤⑥: jerga → materia (regex+corpus+respaldo LLM Fase I) → slots → subsunción top normas.
  const previo = await ejecutarPipelinePrevio(combinedText, input.area, getGeminiClients());
  const resolucionMateria = previo.resolucionMateria;
  const area = resolucionMateria.slug;
  const bloqueSubsuncion = previo.bloqueSubsuncion;
  let ext: ReturnType<typeof extraerChileno> | null = null;
  let planoExt = "";
  try {
    ext = extraerChileno(combinedText);
    planoExt = planoBlindajePrompt(ext);
  } catch { /* silencioso */ }

  // 4. BCN PRE: verificar artículos citados en input (siempre en borradores)
  let citasBCN: Awaited<ReturnType<typeof verificarCitasBCN>> = { verificados: [], pendientes: [] };
  try {
    citasBCN = await verificarCitasBCN([combinedText]);
  } catch (e: any) {
    console.warn(`[draft][bcn-pre] verificacion fallo (sigue sin BCN): ${String(e?.message || e).slice(0, 150)}`);
  }

  // 5. Multi-retrieval jurisprudencial adaptativo.
  // Fase I.5: con núcleo tipado y vía decidida, se consulta por materia +
  // normasBase (no por el texto crudo completo).
  const consultas: ConsultaEtiquetada[] = [];
  if (NUCLEO_TIPADO && decision?.estado === "decidida") {
    const viaDefN = CATALOGO.find((v) => v.id === decision.via);
    if (viaDefN) {
      consultas.push({ texto: `${caso?.materia ?? ""} ${viaDefN.normasBase.join(" ")}`.slice(0, 2500), etiqueta: "via_decidida" });
      consultas.push({ texto: [...(caso?.hechos.map((h) => h.descripcion) ?? []), ...(caso?.pretensiones.map((p) => p.descripcion) ?? [])].join("; ").slice(0, 2500), etiqueta: "hechos_tipados" });
    }
  } else {
    if (input.hechos) consultas.push({ texto: input.hechos.slice(0, 2500), etiqueta: "hechos" });
    if (input.documentoCaso) consultas.push({ texto: input.documentoCaso.slice(0, 2500), etiqueta: "documento" });
    if (dictamenUtil) consultas.push({ texto: dictamenUtil.slice(0, 2500), etiqueta: "dictamen" });
    if (ext) {
      if (ext.secciones.hechos) consultas.push({ texto: ext.secciones.hechos.slice(0, 2200), etiqueta: "hechos" });
      if (ext.secciones.derecho) consultas.push({ texto: ext.secciones.derecho.slice(0, 2500), etiqueta: "derecho" });
      if (ext.secciones.petitorio) consultas.push({ texto: ext.secciones.petitorio.slice(0, 1600), etiqueta: "petitorio" });
      const invocados = [ext.acciones.join(" "), ext.juzgado, ext.articulosInvocados.slice(0, 20).join(" "), ext.normasDetectadas.map(n => n.nombre).join(" ")].filter(Boolean).join(" ");
      if (invocados) consultas.push({ texto: invocados, etiqueta: "invocados" });
    }
    if (!consultas.length) consultas.push({ texto: combinedText.slice(0, 4000), etiqueta: "documento" });
  }

  let juris: Awaited<ReturnType<typeof buscarJurisprudenciaMulti>> = [];
  let casos: Awaited<ReturnType<typeof buscarCasosJurisMulti>> = [];
  try {
    // Fase D: el slug resuelto gobierna la recuperación (corpus del área +
    // capa transversal; base laboral solo como fallback etiquetado).
    juris = await buscarJurisprudenciaMulti(consultas, 6, area ?? undefined);
    casos = await buscarCasosJurisMulti(consultas, 4, area ?? undefined);
  } catch { /* silencioso */ }

  // 6. Construir prompt dinámico
  const plantilla = getPlantilla(input.tipo);
  const articulosClave = getArticulosClave(area);
  const bloqueBCN = bloquePromptBCN(citasBCN);
  const bloqueJuris = juris.length ? `\n\nCRITERIO JURISPRUDENCIAL:\n${juris.slice(0, 4).map(j => `### ${j.institucion}\nFallo rector: CS Rol ${j.falloRector?.rol} (${j.falloRector?.fecha})\n${j.definicion?.slice(0, 300)}`).join("\n\n")}` : "";
  const bloqueCasos = casos.length ? `\n\nCASOS ANÁLOGOS:\n${casos.slice(0, 3).map(c => `${c.tribunal} ${c.sala ? `— ${c.sala}` : ""} | Rol ${c.rol} | ${c.doctrina?.slice(0, 200)}`).join("\n\n")}` : "";

  // Fase D: línea de materia honesta — qué gobierna, de dónde salió y conteos
  // crudos de señales (sin porcentaje de confianza inventado).
  let promptContent = `${lineaMateriaPrompt(resolucionMateria)}\n`;
  promptContent += `TIPO DE ESCRITO: ${input.tipo.toUpperCase()}\n`;
  // Postura procesal: obligatoria en el formulario; el servidor la deriva del
  // tipo cuando falta (compatibilidad API/historial guardado) y lo anota.
  const postura = input.postura ?? (input.tipo === "contestacion" ? "demandado" : input.tipo === "demanda" ? "demandante" : null);
  promptContent += postura
    ? `POSTURA PROCESAL: redactas EXCLUSIVAMENTE por la parte ${postura.toUpperCase()} (regla 4: postura vinculante; jamás cambies de vereda aunque el [DICTAMEN] sea de la contraria).\n`
    : `POSTURA PROCESAL: no indicada — infiela del relato y de las pretensiones (regla 4); no cambies de vereda aunque el [DICTAMEN] sea de la contraria.\n`;
  if (input.rol) promptContent += `ROL: ${input.rol}\n`;
  if (input.tribunal) promptContent += `TRIBUNAL: ${input.tribunal}\n`;
  promptContent += `\nHECHOS:\n${input.hechos}\n\n`;
  promptContent += `PRETENSIONES:\n${input.pretensiones.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n`;
  if (NUCLEO_TIPADO && bloqueViaProcesal) {
    promptContent += bloqueViaProcesal;
  } else {
    if (planoExt) promptContent += planoExt;
    if (bloqueSubsuncion) promptContent += bloqueSubsuncion;
  }
  // Bloques de contexto heredado (Motor v2): documento real + dictamen del caso.
  // Van antes de la plantilla para que fijen hechos/estrategia y la plantilla solo dé forma.
  if (input.documentoCaso) {
    promptContent += `\n[DOCUMENTO DEL CASO] — texto real del expediente; HECHOS, FECHAS y MONTOS autoritativos:\n${input.documentoCaso.slice(0, 9000)}\n`;
  }
  if (dictamenUtil) {
    promptContent += `\n[DICTAMEN TÉCNICO PREVIO] — orienta estrategia solo si el usuario lo adjunta; NO es la demanda:\n${dictamenUtil.slice(0, 9000)}\n`;
  } else if (esDefensaEscrita) {
    promptContent += `\n[REGLA CONTESTACIÓN] Sin dictamen de estrategia. Redacta la defensa SOLO con el [DOCUMENTO DEL CASO] y HECHOS/PRETENSIONES del usuario. No inventes concesiones ni copies la tesis del actor.\n`;
  }
  if (input.respuestasAuditoria?.trim()) {
    promptContent += `\n[DATOS COMPLETADOS POR EL USUARIO] — respuestas a la auditoría de vacíos de una versión anterior del borrador. Insértalas en su lugar exacto (RIT, techo de notificación, patrocinante, testigos, etc.), con la ortografía y detalle que el usuario entregó, y ELIMINA los marcadores que reemplazan:\n${input.respuestasAuditoria.slice(0, 4000)}\n`;
  }
  if (bloqueBCN) promptContent += bloqueBCN;
  // Fase 7: PLAN DE PLAZOS del motor determinista (plazosChile.ts). Los numeros
  // de fechas limites provienen de codigo, no del LLM. Solo aplica cuando el
  // tipo/area tienen plazo registrado y el relato permite inferir notificacion.
  const fechasNotificacion = detectarFechasNotificacion(combinedText); // used por motor + anotaciones
  const plazosMotor = calcularPlazosMotor(area, input.tipo, combinedText, fechasNotificacion);
  const bloquePlazos = bloquePromptPlazos(plazosMotor);
  if (bloquePlazos) promptContent += bloquePlazos;
  // Fase D (honestidad): si el escrito depende de un plazo (demanda/contestación)
  // y el motor NO lo tiene modelado para esta materia, se declara en el prompt —
  // el LLM no puede inventar la fecha límite.
  if (!plazosMotor.length && (input.tipo === "demanda" || input.tipo === "contestacion")) {
    const nombreMateria = area ? MATERIAS[area].nombre : "indeterminada";
    promptContent += `\n[VERIFICACION DE PLAZOS] La materia ${nombreMateria} NO tiene plazos modelados en el motor determinista — NO inventes fecha límite; escribe "[VERIFICAR: plazo de ${input.tipo} según la normativa aplicable]" donde corresponda.`;
  }
  if (fechasNotificacion.ambigua) {
    promptContent += `\n[VERIFICACION DE FECHA] El caso menciona ${fechasNotificacion.fechas.length} fechas de notificacion distintas (${fechasNotificacion.fechas.join("; ")}). El motor usó la primera (${fechasNotificacion.primera}); NO inventes cuál corre: usa la nota de verificación al pie.`;
  }
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
    // Fase 1: SYSTEM_PROMPT_LEGALHELP se pasa SIEMPRE como systemInstruction
    // (antes se definía y nunca se enviaba -> reglas forenses ignoradas).
    const configBase = {
      systemInstruction: SYSTEM_PROMPT_LEGALHELP,
      temperature: 0.1,
      maxOutputTokens: 8192,
    };
    const clients = getGeminiClients();
    try {
      const response = await generateWithFallback(
        clients,
        { contents: { parts: [{ text: promptContent }] }, config: { ...configBase, tools: PREMIUM_GROUNDING_ENABLED ? [{ googleSearch: {} }] : undefined } },
        { requireGrounding: PREMIUM_GROUNDING_ENABLED, skipLite: PREMIUM_GROUNDING_ENABLED }
      );
      draft = response.text || "";
    } catch (e: any) {
      // Fallback sin grounding: registrar el motivo (antes se tragaba sin log).
      console.warn("draft: generación con grounding falló, reintentando sin grounding:", String(e?.message || e).slice(0, 300));
      const response = await generateWithFallback(
        clients,
        { contents: { parts: [{ text: promptContent }] }, config: configBase },
        { skipLite: true }
      );
      draft = response.text || "";
    }
    if (!draft.trim()) throw new Error("Modelo no devolvió contenido");
    draft = limpiarEscapesCorchetes(draft);
    draftCache.set(llmKey, { data: { draft, validacion: null as any, bcn: null as any, metadatos: null as any }, expires: Date.now() + CACHE_TTL });
  }

  // 8.5 Control determinista posterior a la generación: si el plazo calculado
  // ya venció, elimina afirmaciones incompatibles aunque el modelo haya
  // ignorado el prompt. Deja un marcador visible para revisión en OJV.
  const saneamientoPlazo = sanitizarAfirmacionPlazoVencido(draft, plazosMotor);
  if (saneamientoPlazo.corregidos > 0) {
    draft = saneamientoPlazo.texto + `\n\n## ⚠️ Corrección automática de plazo\n\nSe reemplazó una afirmación de oportunidad procesal porque el motor calculó vencimiento el ${saneamientoPlazo.fechas[0]}. Confirma la fecha del receptor y el estado de la causa en OJV antes de presentar.\n`;
  }

  // 9. BCN POST: verificar artículos en el borrador generado
  let citasBCNFinal = citasBCN;
  try {
    const bcnPost = await verificarCitasBCN([draft], { permitirSemilla: false }); // texto GENERADO: sin semilla (Fase I.4)
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
  } catch (e: any) {
    console.warn(`[draft][bcn-post] verificacion del borrador fallo (sigue con BCN pre): ${String(e?.message || e).slice(0, 150)}`);
  }

  // 10. Validador LegalHelp
  const rolesCorpus = [
    ...juris.map(j => j.falloRector?.rol).filter(Boolean),
    ...casos.map(c => c.rol).filter(Boolean),
  ] as string[];

  const insumos: InsumosValidacionLegalHelp = {
    rolesCorpus,
    // Fase 4: cobertura por clave "KEY:art" (p.ej. "L18290:157"), no por numero
    // suelto: el validador cruza cada cita del borrador con la norma que el
    // extractor BCN le asigno en ese mismo texto.
    artsCubiertos: citasBCNFinal.verificados.map(a => `${a.keyNorma}:${a.articulo}`),
    artsPendientes: citasBCNFinal.pendientes.flatMap(p => p.articulosPedidos || []),
    montosDoc: ext?.montos || [],
    textoDoc: combinedText,
    area,
    tipo: input.tipo,
  };

  const draftCuerpo = draft;
  let validacion: ValidacionLegalHelp;
  try {
    validacion = validarLegalHelp(draftCuerpo, insumos);
    const nota = notaBlindajeLegalHelp(validacion);
    if (nota) draft = draft + nota;
  } catch { validacion = validarLegalHelp("", insumos); }

  // 10.5 Auditoría determinista de vacíos críticos (Fase 2)
  let vacios: VacioCritico[] = [];
  try {
    vacios = auditarVacios(draftCuerpo, input);
  } catch { /* silencioso */ }

  // 10.55 Linting táctico procesal (Ley Bustos + feriado/HE): intercepta alucinaciones
  // del LLM antes de entregar el escrito. Solo aplica en laboral.
  // cuerpoSanitizado = cuerpo ya corregido por el lint procesal y SIN sus notas:
  // es lo que evalúa el lint de borrador (evita duplicar hallazgos ya saneados).
  let cuerpoSanitizado = draft;
  let lintTacticoProc: ReturnType<typeof lintTacticoProcesal> = [];
  try {
    lintTacticoProc = lintTacticoProcesal(draft, area);
    if (lintTacticoProc.length) {
      const { texto: draftLimpio, corregidos } = sanitizarTactico(draft, lintTacticoProc);
      draft = draftLimpio;
      cuerpoSanitizado = draftLimpio;
      if (corregidos || lintTacticoProc.some((h) => h.severidad === "bloqueante")) {
        draft +=
          `\n\n## ⚠️ Control táctico procesal (automático)\n` +
          lintTacticoProc.map((h) => `- [${h.regla}] «${h.snippet}» → ${h.sugerencia}`).join("\n") +
          "\n";
      }
    }
  } catch { /* silencioso: el lint jamás rompe el borrador */ }

  // 10.6 Cross-check plazos (Fase 7, enforcement de ANOTACIÓN): verifica que la
  // fecha límite calculada por el motor aparezca consignada en el borrador (en
  // cualquier formato razonable). Si no aparece, se appenda una nota visible.
  // NUNCA bloquea (decisión Fase 7: los borradores gratuitos no bloquean por
  // falso positivo; solo el dictamen pagado tiene gate, y ese es otro endpoint).
  let chequeoPlazos: ReturnType<typeof chequearPlazosEnBorrador> = [];
  try {
    chequeoPlazos = chequearPlazosEnBorrador(plazosMotor, draftCuerpo);
    // Capa warn unificada: fecha ambigua + plazo vencido + límite no consignada
    const anotaciones = anotacionesPlazos(plazosMotor, draftCuerpo, fechasNotificacion);
    if (anotaciones.length) {
      const lineas = anotaciones.map((a) => `- ⚠️ ${a}`);
      draft = draft + `\n\n## ⚠️ Nota de verificación de plazos (control automático)\n\n${lineas.join("\n")}\n`;
    }
  } catch { /* silencioso: el cross-check jamás rompe el borrador */ }

  // 10.7 Control táctico determinista (Ley Bustos, allanamiento, postura,
  // monitorio y plazos vencidos): anota de forma visible sin bloquear.
  let tactico: HallazgoTactico[] = [];
  try {
    const plazoVencido = plazosMotor.some((p) => p.vencido === true);
    tactico = lintTacticoBorrador(cuerpoSanitizado, { tipo: input.tipo, postura, plazoVencido });
    if (tactico.length) {
      draft = draft + notaTactica(tactico);
    }
  } catch { /* silencioso: el control táctico jamás rompe el borrador */ }

  // Fase I.5: vía sin revisión de abogado => nota visible.
  if (NUCLEO_TIPADO && decision?.estado === "decidida") {
    const viaDefNota = CATALOGO.find((v) => v.id === decision.via);
    if (viaDefNota && !viaDefNota.verificadaPorAbogado) {
      draft = draft + "\n\n> **Nota:** Vía procesal sin revisión de abogado.\n";
    }
  }

  // 11. Output
  const output: DraftOutput = {
    draft,
    validacion,
    vacios,
    tactico: tactico.length ? tactico : undefined,
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
      // Fase 7: plazos calculados por el motor (para QA y UI card de plazos)
      plazosMotor: plazosMotor.length ? plazosMotor : undefined,
      // Fase 7: cross-check (¿el borrador consigna la fecha límite del motor?)
      chequeoPlazos: chequeoPlazos.length ? chequeoPlazos : undefined,
      audience: input.audience || "abogado",
      lintTactico: lintTacticoProc.length ? lintTacticoProc : undefined,
    },
  };

  draftCache.set(cKey, { data: output, expires: Date.now() + CACHE_TTL });
  return output;
}
