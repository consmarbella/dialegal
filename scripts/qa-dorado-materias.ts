// QA Fase D.2/D.3 — SET DORADO de decisión de materia (evaluation/dorado-materias.jsonl).
//
// Qué mide: la plataforma (decidirMateria = átomos + ventana + negación +
// anclas + BM25 normalizado) frente a 39 casos con materia esperada escrita a
// mano. NO toca red ni Gemini. Reporta:
//   - matriz de confusión esperado × obtenido,
//   - precisión / recall por materia,
//   - tasa de abstención (indeterminada),
//   - error civil↔laboral (la contaminación real de la Fase A),
//   - origen de la decisión (senales / corpus / declarada / indeterminada),
//   - incumplimientos y negaciones detectados en los casos que los exigen.
// Falla (exit 1) si algún caso no cumple su expectativa: las métricas que
// imprime son REALES, calculadas sobre los casos, nunca inventadas.
//
// Corre con corpus: CORPUS_COMPLETO=true (sin eso el BM25 se abstiene y los
// casos de desempate/empate cambian de resultado).
//
//   $env:CORPUS_COMPLETO="true"; npx tsx scripts/qa-dorado-materias.ts

process.env.CORPUS_COMPLETO = "true";

import fs from "fs";
import path from "path";

const { decidirMateria } = await import("../src/server/materiaDecision.js");
const { MATERIAS } = await import("../materias.js");
type SlugMateria = import("../materias.js").SlugMateria;

interface CasoDorado {
  id: string;
  categoria: string;
  /** slug(s) aceptado(s); "indeterminada" = espera abstención */
  esperado?: string | string[];
  area_declarada?: string | null;
  /** origen(es) exigido(s): senales | corpus | declarada | indeterminada */
  origen?: string | string[];
  /** origen(es) PROHIBIDO(s): p. ej. "senales" en casos de negación/empate */
  origen_no?: string[];
  /** materia secundaria esperada (caso mixto) */
  secundaria?: string;
  /** exige que clasificacion.negaciones no esté vacío */
  requiere_negacion?: boolean;
  /** exige que clasificacion.incumplimientos no esté vacío */
  requiere_incumplimiento?: boolean;
  texto?: string;
  notas?: string;
}

const asArray = (v?: string | string[]): string[] | null =>
  v == null ? null : Array.isArray(v) ? v : [v];

const ruta = path.join(process.cwd(), "evaluation", "dorado-materias.jsonl");
const lineas = fs.readFileSync(ruta, "utf-8").split(/\r?\n/).filter((l) => l.trim());
const casos: CasoDorado[] = [];
for (const [i, l] of lineas.entries()) {
  try { casos.push(JSON.parse(l)); }
  catch (e: any) { console.error(`JSON inválido en línea ${i + 1}: ${e?.message}`); process.exit(1); }
}
if (!casos.length) { console.error("Set dorado vacío."); process.exit(1); }

const MATERIAS_7: SlugMateria[] = ["civil", "laboral", "familia", "penal", "administrativo", "constitucional", "transito"];

// ── corrida ──────────────────────────────────────────────────────────────────
interface Resultado {
  caso: CasoDorado;
  got: string;
  origen: string;
  secundaria: string | null;
  negaciones: number;
  incumplimientos: number;
  problemas: string[];
}

const resultados: Resultado[] = [];
for (const caso of casos) {
  const texto = caso.texto || "";
  const r = decidirMateria(caso.area_declarada ?? null, texto);
  const got = r.slug ?? "indeterminada";
  const problemas: string[] = [];
  const esperados = asArray(caso.esperado);
  if (esperados && !esperados.includes(got)) {
    problemas.push(`esperado ${esperados.join(" | ")}, obtuvo "${got}" (origen ${r.origen}; señales: ${r.clasificacion.scores.map((s) => `${s.slug}=${s.puntos}`).join(",") || "ninguna"})`);
  }
  const origenes = asArray(caso.origen);
  if (origenes && !origenes.includes(r.origen)) {
    problemas.push(`origen esperado ${origenes.join(" | ")}, obtuvo "${r.origen}"`);
  }
  if (caso.origen_no?.includes(r.origen)) {
    problemas.push(`origen PROHIBIDO "${r.origen}" (permitido: no ${caso.origen_no.join(", ")})`);
  }
  const secundaria = r.materiaSecundaria ?? null;
  if (caso.secundaria && secundaria !== caso.secundaria) {
    problemas.push(`secundaria esperada "${caso.secundaria}", obtuvo "${secundaria ?? "ninguna"}"`);
  }
  if (caso.requiere_negacion && r.negaciones.length === 0) {
    problemas.push("no detectó negación (clasificacion.negaciones vacío)");
  }
  if (caso.requiere_incumplimiento && r.clasificacion.incumplimientos.length === 0) {
    problemas.push("no detectó incumplimiento afirmado (clasificacion.incumplimientos vacío)");
  }
  if (!texto) problemas.push("caso sin texto");
  resultados.push({
    caso, got, origen: r.origen, secundaria,
    negaciones: r.negaciones.length,
    incumplimientos: r.clasificacion.incumplimientos.length,
    problemas,
  });
}

// ── matriz de confusión (casos con un solo esperado y sin área declarada) ────
const enMatriz = (c: CasoDorado) =>
  c.area_declarada == null && c.esperado != null && asArray(c.esperado)!.length === 1;
const filas = [...new Set(resultados.filter((x) => enMatriz(x.caso)).map((x) => asArray(x.caso.esperado)![0]))];
const cols = [...new Set(resultados.filter((x) => enMatriz(x.caso)).map((x) => x.got))];
const matriz = new Map<string, Map<string, number>>();
for (const f of filas) {
  matriz.set(f, new Map());
  for (const c of cols) matriz.get(f)!.set(c, 0);
}
for (const x of resultados) {
  if (!enMatriz(x.caso)) continue;
  const f = asArray(x.caso.esperado)![0];
  if (!matriz.has(f)) matriz.set(f, new Map());
  const fila = matriz.get(f)!;
  fila.set(x.got, (fila.get(x.got) || 0) + 1);
}

const anchoFila = Math.max(6, ...filas.map((f) => f.length), ...cols.map((c) => c.length));
const anchoCol = Math.max(5, ...cols.map((c) => c.length + 1));
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));

console.log("\nMATRIZ DE CONFUSIÓN (esperado × obtenido)");
console.log(pad("", anchoFila + 1) + cols.map((c) => pad(c, anchoCol)).join(""));
for (const f of filas) {
  const fila = matriz.get(f)!;
  const total = [...fila.values()].reduce((a, b) => a + b, 0);
  const linea = cols.map((c) => {
    const v = fila.get(c) || 0;
    return pad(v === 0 ? "·" : (f === c ? String(v) : `${v}`), anchoCol);
  }).join("");
  console.log(`${pad(f, anchoFila + 1)}${linea}  (n=${total})`);
}

// ── precisión / recall por materia ───────────────────────────────────────────
console.log("\nPRECISIÓN / RECALL POR MATERIA (sobre casos con esperado único)");
console.log(pad("materia", 16) + pad("prec", 8) + pad("recall", 8) + pad("TP", 5) + pad("FP", 5) + pad("FN", 5) + "n");
let tpTotal = 0, fnTotal = 0, fpTotal = 0;
for (const m of MATERIAS_7) {
  const esperadosM = resultados.filter((x) => enMatriz(x.caso) && asArray(x.caso.esperado)![0] === m);
  const predichosM = resultados.filter((x) => enMatriz(x.caso) && x.got === m);
  const tp = esperadosM.filter((x) => x.got === m).length;
  const fn = esperadosM.length - tp;
  const fp = predichosM.filter((x) => asArray(x.caso.esperado)![0] !== m).length;
  const prec = predichosM.length ? tp / predichosM.length : NaN;
  const rec = esperadosM.length ? tp / esperadosM.length : NaN;
  tpTotal += tp; fnTotal += fn; fpTotal += fp;
  const fmt = (v: number) => (Number.isNaN(v) ? "  n/a" : `${(v * 100).toFixed(1)}%`);
  console.log(
    pad(m, 16) + pad(fmt(prec), 8) + pad(fmt(rec), 8) +
    pad(String(tp), 5) + pad(String(fp), 5) + pad(String(fn), 5) +
    String(esperadosM.length),
  );
}

// ── abstención y error civil↔laboral ─────────────────────────────────────────
const enMatrizRs = resultados.filter((x) => enMatriz(x.caso));
const abstenciones = enMatrizRs.filter((x) => x.got === "indeterminada");
const civilLaboral =
  (matriz.get("civil")?.get("laboral") || 0) + (matriz.get("laboral")?.get("civil") || 0);
const aciertos = enMatrizRs.filter((x) => asArray(x.caso.esperado)![0] === x.got).length;

console.log("\nAGREGADOS");
console.log(`  casos en matriz        : ${enMatrizRs.length}`);
console.log(`  aciertos               : ${aciertos}/${enMatrizRs.length} (${((aciertos / enMatrizRs.length) * 100).toFixed(1)}%)`);
console.log(`  abstención (esperadas) : ${abstenciones.length} → ${abstenciones.map((x) => x.caso.id).join(", ") || "ninguna"}`);
console.log(`  error civil↔laboral    : ${civilLaboral}`);
console.log(`  recall macro (materias): ${(() => {
  const rs: number[] = [];
  for (const m of MATERIAS_7) {
    const esp = resultados.filter((x) => enMatriz(x.caso) && asArray(x.caso.esperado)![0] === m);
    if (esp.length) rs.push(esp.filter((x) => x.got === m).length / esp.length);
  }
  return rs.length ? `${((rs.reduce((a, b) => a + b, 0) / rs.length) * 100).toFixed(1)}%` : "n/a";
})()}`);

const porOrigen = new Map<string, number>();
for (const x of resultados) porOrigen.set(x.origen, (porOrigen.get(x.origen) || 0) + 1);
console.log(`  origen de la decisión  : ${[...porOrigen].map(([k, v]) => `${k}=${v}`).join(", ")}`);

// ── detalle por caso ─────────────────────────────────────────────────────────
console.log("\nDETALLE");
let ok = 0, fail = 0;
for (const x of resultados) {
  if (x.problemas.length) {
    fail++;
    console.log(`FAIL ${x.caso.id} [${x.caso.categoria}] → ${x.got} (${x.origen})${x.secundaria ? ` + ${x.secundaria}` : ""}`);
    for (const p of x.problemas) console.log(`     · ${p}`);
  } else {
    ok++;
    console.log(`PASS ${x.caso.id} [${x.caso.categoria}] → ${x.got} (${x.origen})${x.secundaria ? ` + ${x.secundaria}` : ""}${x.negaciones ? ` negaciones=${x.negaciones}` : ""}${x.incumplimientos ? ` incumplimientos=${x.incumplimientos}` : ""}`);
  }
}

console.log(`\nDORADO MATERIAS: ${ok} pass, ${fail} fail (${casos.length} casos)`);
if (fail > 0) process.exit(1);
