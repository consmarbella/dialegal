// QA Fase E: verificador de citas del registro de plazos contra el XML
// oficial de Ley Chile (canal Consulta/obtxml?opt=7). Sin LLM, sin corpus:
// pura sentencia documental. Cada assert es una cita que el motor imprime
// como "fuente" en los borradores.
//
// Mandato del dueño / hallazgos.md §7.1: confirmar 21.394 -> CPC 258.
//
// RESULTADOS DE LA PRIMERA CORRIDA (2026-10-29) que motivaron cambios en el
// registro PLAZOS (plazosChile.ts) — los asserts DOCUMENTAN los hallazgos:
//  A. CONFIRMADO: CPC 258 (fv 2021-11-30) dice "dieciocho días"; 21.394 N.12
//     dice "reemplazanSE" (plural) "quince" por "dieciocho"; CPC 259 = tabla
//     quinquenal ("se aumentará de conformidad"); CPC 66 fv 2014 = solo
//     suspende en feriados (sábados corren: Ley 2.977 art. 2).
//  B. HALLAZGO GRAVE: el CT vigente NO tiene plazo de 15 días hábiles para
//     contestar demanda laboral. CT 446 (fv 2008) = solo contenido de la
//     demanda; la contestación es en la audiencia preparatoria: CT 451
//     (audiencia dentro de 35 días de la resolución) y CT 452 (por escrito ≥5
//     días antes de la audiencia, o verbal en ella). laboral_contestacion
//     (15 días, "CT art. 446") fue REMOVIDO del registro.
//  C. HALLAZGO DE CANAL: el XML del CT (idNorma 207436) TRUNCA en art. 519
//     (termina en la promulgación 2003-01-16; arts. 520+, incl. 533/540,
//     ausentes) -> "CT art. 533" era INVERIFICABLE y laboral_apelacion fue
//     REMOVIDO del registro.
//  D. HALLAZGO: Ley 19.968 art. 51 NO trata de apelación (es declaración de
//     partes). La apelación en familia = art. 67, que REMITE AL CPC; CPC 189
//     (fv 1989): término fatal de 5 días (10 para sentencias definitivas).
//     familia_apelacion fue re-modelado: calendario CPC + fundamento
//     "L19.968 art. 67 + CPC art. 189".
//  E. HALLAZGO menor: la cita "CPC art. 251: corre desde el día siguiente /
//     24 horas" del desglose del motor era ERRÓNEA (el 251 actual = ejecución
//     de resoluciones extranjeras); el desglose ahora cita art. 66 (verificado).
//
// Descarga directa (no vía verificarCitasBCN): el CPC es ~57 MB y el canal de
// runtime es frágil con cuerpos enormes (hallazgos §6). Cuota BCN: 4 fetches.

import fs from "node:fs";
import path from "node:path";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(typeof data === "string" ? data.slice(0, 300) : (data ?? ""))}`); }
}

function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d: string) => { const n = parseInt(d, 10); return n === 160 ? " " : String.fromCodePoint(n); })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function quitarTags(s: string): string { return s.replace(/<\/?[A-Za-z][^>]*>/g, ""); }
function normalizar(s: string): string {
  return quitarTags(decodificar(s)).replace(/\s+/g, " ").trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Partes de tipo artículo del XML BCN: clave = número de artículo (los
 *  nombres de parte vienen solo con el número), valor = texto normalizado +
 *  fechaVersion. Réplica del parseo de bcnLeyChile.ts (misma regex). */
function extraerArticulos(xml: string): Map<string, { texto: string; fechaVersion: string }> {
  const out = new Map<string, { texto: string; fechaVersion: string }>();
  const re = /<EstructuraFuncional[^>]*tipoParte="Art(?:[^\w>]|&#\d+;|[^\s>])*[^>]*>([\s\S]*?)<\/EstructuraFuncional>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const bloque = m[1];
    const nombreM = bloque.match(/<NombreParte[^>]*>([\s\S]*?)<\/NombreParte>/);
    if (!nombreM) continue; // (el CC/DFL usa partes sin NombreParte: no aplica aquí)
    const numero = normalizar(nombreM[1]).replace(/^art\.?\s*/, "").trim();
    const textoM = bloque.match(/<Texto>([\s\S]*?)<\/Texto>/);
    const fvM = m[0].slice(0, m[0].indexOf(">")).match(/fechaVersion="([0-9-]{8,10})"/);
    if (!out.has(numero)) out.set(numero, { texto: normalizar(textoM?.[1] || ""), fechaVersion: fvM ? fvM[1] : "" });
  }
  return out;
}

async function fetchXML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (uso verificacion normativa; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  return res.text();
}
const UA_URL = (q: string) => `https://www.leychile.cl/Consulta/obtxml?opt=7&${q}`;

// ── 1. CPC (idNorma 22740) ──────────────────────────────────────────────────
let cpc: Map<string, { texto: string; fechaVersion: string }>;
try {
  const xml = await fetchXML(UA_URL("idNorma=22740"));
  cpc = extraerArticulos(xml);
  const a258 = cpc.get("258");
  chk("1a CPC art. 258 existe", !!a258, [...cpc.keys()].filter(k => k.startsWith("25")).slice(0, 10));
  if (a258) {
    chk("1b CPC 258 vigente dice DIECIOCHO dias", a258.texto.includes("dieciocho dias"), a258.texto.slice(0, 200));
    chk("1c CPC 258 NO dice quince (termino base)", !a258.texto.includes("quince"), a258.texto.slice(0, 200));
    chk("1d CPC 258 fv 2021-11-30 (Ley 21.394)", a258.fechaVersion === "2021-11-30", a258.fechaVersion);
  }
  const a259 = cpc.get("259");
  if (a259) {
    chk("2a CPC 259 = tabla quinquenal CS ('se aumentara de conformidad')", a259.texto.includes("se aumentara de conformidad") && a259.texto.includes("tabla"), a259.texto.slice(0, 200));
    chk("2b CPC 259 NO dice 'sera de dieciocho dias'", !a259.texto.includes("sera de dieciocho dias"), a259.texto.slice(0, 200));
  } else chk("2a CPC 259 existe", false, [...cpc.keys()].filter(k => k.startsWith("25")).slice(0, 10));
  const a66 = cpc.get("66");
  if (a66) {
    chk("3a CPC 66 fv 2014: 'suspendidos durante los feriados'", a66.fechaVersion === "2014-09-04" && a66.texto.includes("suspendidos durante los feriados"), a66.texto.slice(0, 200));
    chk("3b CPC 66 vigente NO excluye sabados (Ley 2.977 art. 2: sabado solo dependencias publicas)", !a66.texto.includes("sabado"), a66.texto.slice(0, 200));
  } else chk("3a CPC 66 existe", false, [...cpc.keys()].filter(k => k.startsWith("6")).slice(0, 10));
  const a251 = cpc.get("251");
  // Hallazgo E: el 251 actual = ejecucion de resoluciones extranjeras (la cita
  // "24 horas / dia siguiente" del desglose viejo era erronea).
  if (a251) chk("3c CPC 251 actual = resoluciones extranjeras (documenta correccion de cita)", a251.texto.includes("resolucion pronunciada en pais extranjero"), a251.texto.slice(0, 150));
  const a189 = cpc.get("189");
  if (a189) {
    chk("3d CPC 189: apelacion = termino fatal de CINCO dias", a189.texto.includes("termino fatal de cinco dias"), a189.texto.slice(0, 200));
    chk("3e CPC 189: 10 dias para sentencias definitivas (variante anotada)", a189.texto.includes("diez dias") && a189.texto.includes("definitivas"), a189.texto.slice(0, 300));
  } else chk("3d CPC 189 existe", false, [...cpc.keys()].filter(k => k.startsWith("18")).slice(0, 10));
  const a107 = cpc.get("107"), a486 = cpc.get("486");
  chk("3f CPC arts. 107 y 486 existen (apelacion auto / oposicion medida)", !!a107 && !!a486);
} catch (e: any) {
  chk("1 CPC fetch+parse", false, String(e?.message || e));
  cpc = new Map();
}

// ── 2. Ley 21.394 (idLey) ───────────────────────────────────────────────────
try {
  const xml = await fetchXML(UA_URL("idLey=21394"));
  const t = normalizar(xml);
  // Verbatim confirmado por probe: "12) modificase el articulo 258 en el
  // siguiente sentido: a) reemplazanse, en el inciso primero, la palabra
  // "quince" por "dieciocho"" (REEMPLAZANSE con s final: plural).
  chk("4a Ley 21.394 N.12: 'reemplazanse... quince' por 'dieciocho' en el 258",
    t.includes("reemplazanse, en el inciso primero, la palabra") && t.includes('"quince" por "dieciocho"') && t.includes("modificase el articulo 258"), null);
  chk("4b Ley 21.394 N.13: 259 pasa a 'se aumentara de conformidad'",
    t.includes('"sera de dieciocho dias, y a mas el aumento que corresponda" por "se aumentara de conformidad"'), null);
} catch (e: any) {
  chk("4 Ley 21.394 fetch+parse", false, String(e?.message || e));
}

// ── 3. CT (idNorma 207436): hallazgos B y C como asserts ────────────────────
try {
  const ctXml = await fetchXML(UA_URL("idNorma=207436"));
  const ct = extraerArticulos(ctXml);
  const tCt = normalizar(ctXml);
  const a446 = ct.get("446");
  if (a446) {
    // Hallazgo B: el 446 vigente (fv 2008) solo define el CONTENIDO de la
    // demanda — NO fija plazo de contestacion.
    chk("5a CT 446 existe PERO no fija plazo de contestacion (fv 2008 = contenido de la demanda)",
      a446.texto.includes("debera contener") && !a446.texto.includes("quince dias"), a446.texto.slice(0, 150));
  } else chk("5a CT 446 existe", false, [...ct.keys()].filter(k => k.startsWith("44")).slice(0, 10));
  const a451 = ct.get("451"), a452 = ct.get("452");
  chk("5b CT 451: audiencia preparatoria dentro de 35 dias de la resolucion",
    !!a451 && a451.texto.includes("treinta y cinco dias") && a451.texto.includes("audiencia preparatoria"), a451?.texto.slice(0, 200));
  chk("5c CT 452: contestacion por escrito >=5 dias antes de la audiencia (o verbal en ella)",
    !!a452 && a452.texto.includes("contestar la demanda") && a452.texto.includes("cinco dias de antelacion"), a452?.texto.slice(0, 200));
  // Hallazgo C: el canal trunca en art. 519 -> 533 no verificable.
  chk("5d CT por idNorma 207436 trunca en art. 519 (533 ausente -> laboral_apelacion removido)",
    !ct.has("533") && !tCt.includes("art. 533") && !tCt.includes("articulo 533"), null);
} catch (e: any) {
  chk("5 CT fetch+parse", false, String(e?.message || e));
}

// ── 4. Ley 19.968 (idNorma 229557): hallazgo D como asserts ─────────────────
try {
  const l = extraerArticulos(await fetchXML(UA_URL("idNorma=229557")));
  const a51 = l.get("51"), a67 = l.get("67");
  if (a51) chk("6a Ley 19.968 art. 51 = declaracion de partes (documenta cita erronea previa)",
    a51.texto.includes("declaracion") && !a51.texto.includes("apelacion"), a51.texto.slice(0, 150));
  chk("6b Ley 19.968 art. 67 remite los recursos al CPC (fundamento de familia_apelacion)",
    !!a67 && a67.texto.includes("codigo de procedimiento civil") && a67.texto.includes("recursos"), a67?.texto.slice(0, 200));
} catch (e: any) {
  chk("6 Ley 19.968 fetch+parse", false, String(e?.message || e));
}

// ── 5. Coherencia del registro PLAZOS: cada fundamento cita artículos
//    verificados arriba (cruce duro; si se agrega un plazo, este QA obliga a
//    sentenciar su cita contra BCN antes de desplegar). ──────────────────────
const P = await import("../plazosChile.js");
const CITAS_ESPERADAS: Record<string, Array<{ norma: string; articulo: RegExp }>> = {
  civil_contestacion: [{ norma: "CPC", articulo: /art\.? 258/ }, { norma: "CPC", articulo: /art\.? 66/ }],
  civil_apelacion_auto: [{ norma: "CPC", articulo: /art\.? 107/ }],
  civil_oposicion_medida: [{ norma: "CPC", articulo: /art\.? 486/ }],
  familia_apelacion: [{ norma: "Ley 19.968", articulo: /art\.? 67/ }, { norma: "CPC", articulo: /art\.? 189/ }],
};
let coherentes = 0, incoherentes = 0;
for (const p of P.PLAZOS) {
  const esperadas = CITAS_ESPERADAS[p.id];
  if (!esperadas) { incoherentes++; console.log(`   plazo ${p.id}: sin entrada en CITAS_ESPERADAS — senténciala contra BCN`); continue; }
  const faltan = esperadas.filter(c => !p.fundamento.includes(c.norma) || !c.articulo.test(p.fundamento));
  if (faltan.length === 0) coherentes++;
  else { incoherentes++; console.log(`   plazo ${p.id}: fundamento no cita ${faltan.map(f => f.norma + " " + f.articulo).join("; ")}`); }
}
chk("7 todos los plazos del registro citan sus articulos verificados", incoherentes === 0, { coherentes, incoherentes });
chk("8 el registro ya NO contiene plazos laborales refutados/inverificables",
  !P.existePlazo("laboral_contestacion") && !P.existePlazo("laboral_apelacion") && P.PLAZOS.length === 4, P.PLAZOS.map(p => p.id));

// Reporte para evaluacion/ (trazabilidad)
try {
  const dir = path.resolve("evaluation", "citas-faseE");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify({
    fecha: new Date().toISOString(),
    ok, fail,
    confirma: { "Ley 21.394 -> CPC art. 258 (quince->dieciocho)": fail === 0 },
    hallazgos: {
      "laboral_contestacion": "removido: CT vigente no fija plazo de contestacion (audiencia preparatoria CT 451/452)",
      "laboral_apelacion": "removido: canal leychile del CT trunca en art. 519 (CT 533 inverificable)",
      "familia_apelacion": "re-modelado: L19.968 art. 67 (remite al CPC) + CPC art. 189 (5 dias; 10 definitivas)",
      "cita_251_cpc": "desglose del motor corregido: el 251 actual = resoluciones extranjeras; ahora cita art. 66",
    },
    detalle: "Ver scripts/qa-citas-faseE.ts; sentencia contra XML oficial leychile (obtxml opt=7).",
  }, null, 2));
} catch { /* reporte es best-effort */ }

console.log(`\nQA citas Fase E: ${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
