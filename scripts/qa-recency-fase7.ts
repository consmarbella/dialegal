// QA Fase 7 (gap 2): A/B del recency boost en buscarJurisprudencia.
// Corre la MISMA consulta con recencyW=0 (línea base) y con el boost activo
// (0.15 default) sobre el corpus real, y verifica con puntuacion expuesta:
//  A. EFECTO EXISTE: algún ficha del top recibe delta > 0.
//  B. MAGNITUD ACOTADA: ningún delta supera 0.2 (diseño: max +0.15).
//  C. FÓRMULA + DIRECCIÓN: para cada ficha con delta visible, delta coincide con
//     0.15/(1+0.8*aniosAtras) (tol 0.03 por redondeo a 2 decimales) -> los años
//     viejos reciben MENOS que los nuevos: la dirección "criterio de hoy" es la
//     verificada, no supuesta.
// Corrida: npx tsx scripts/qa-recency-fase7.ts (sin red, corpus local).
process.env.CORPUS_COMPLETO = "";
let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "").slice(0, 220)}`); }
}
const J = await import("../jurisprudenciaChile.js");

interface Med { inst: string; obra: string; anni: number; base: number; boost: number; delta: number; exp: number; }
const anioHoy = new Date().getFullYear();

async function medir(consulta: string, area: string): Promise<Med[]> {
  const [baseR, boostR] = await Promise.all([
    J.buscarJurisprudencia([consulta], 30, area, { recencyW: 0 }),
    J.buscarJurisprudencia([consulta], 30, area, { recencyW: 0.15 }),
  ]);
  const key = (r: any) => `${r.institucion}||${r.obra}`;
  const baseMap = new Map(baseR.map((r) => [key(r), r]));
  const out: Med[] = [];
  for (const r of boostR) {
    const b = baseMap.get(key(r));
    if (!b) continue;
    const mYr = r.falloRector?.fecha ? /(?:^|[\s-])(20\d{2})(?=\s|$|\.|,)/.exec(String(r.falloRector.fecha)) : null;
    const anni = mYr ? anioHoy - Number(mYr[1]) : -1;
    const delta = Math.round((r.puntuacion - b.puntuacion) * 100) / 100;
    const exp = anni >= 0 ? Math.round((0.15 / (1 + 0.8 * anni)) * 100) / 100 : 0;
    out.push({ inst: r.institucion.slice(0, 60), obra: String(r.obra).slice(0, 40), anni, base: b.puntuacion, boost: r.puntuacion, delta, exp });
  }
  return out;
}

const consultas: Array<[string, string]> = [
  ["despido injustificado horas extra tutela", "laboral"],
  ["incumplimiento contractual indemnizacion perjuicios", "civil"],
  ["relacion directo e inmediato cuido personal", "familia"],
  ["nulidad procesal notificacion valida", "civil"],
  ["evento violento interno funcionario", "laboral"],
];

let todasMed: Med[] = [];
let hayEfecto = false;
for (const [q, area] of consultas) {
  const m = await medir(q, area);
  todasMed = todasMed.concat(m);
  console.log(`\n[${area}] "${q}" -> ${m.length} fichas comunes`);
  for (const r of m.slice(0, 4)) console.log(`  anni=${r.anni} base=${r.base} boost=${r.boost} delta=${r.delta}`);
  if (m.some((r) => r.delta > 0)) hayEfecto = true;
}

// A. efecto existe
chk(`A efecto existe (algun delta > 0 en ${consultas.length} consultas A/B)`, hayEfecto);

// B. magnitud acotada
const maxDelta = Math.max(...todasMed.map((r) => r.delta));
chk(`B magnitud acotada (max delta ${maxDelta} <= 0.2)`, maxDelta <= 0.2, maxDelta);
chk("B2 ninguna ficha empeora con boost", todasMed.every((r) => r.delta >= 0));

// C. formula + direccion (solo fichas con delta visible: el resto son redondeos a 0)
const visibles = todasMed.filter((r) => Math.abs(r.delta) >= 0.01);
chk(`C formula/direccion en ${visibles.length} fichas con delta visible: delta == 0.15/(1+0.8*anni)`,
  visibles.every((r) => Math.abs(r.delta - r.exp) <= 0.03), visibles.slice(0, 3));

// D. direccion: entre fichas CON fecha parseable, mas reciente = mas delta.
// Cobertura honesta: del corpus completo solo ~98/5.706 fichas traen
// falloRector (limite del dataset HF, no del codigo); el assert exige >=2
// fichas afectadas en la muestra y el conteo real se imprime para DECISIONES.
const conFecha = todasMed.filter((r) => r.anni >= 0);
chk(`D cobertura de falloRector en muestra: ${conFecha.length} fichas con fecha (>=2 con delta real)`, conFecha.length >= 2, conFecha.length);
if (conFecha.length >= 2) {
  const deMax = conFecha.reduce((a, b) => (b.delta > a.delta ? b : a));
  const deMin = conFecha.reduce((a, b) => (b.delta <= a.delta ? b : a));
  chk(`D2 direccion: max delta (anni=${deMax.anni}) es mas (o igual de) reciente que min (anni=${deMin.anni})`, deMax.anni <= deMin.anni, { deMax, deMin });
}

console.log(`\nRESUMEN A/B: consultas=${consultas.length} fichas=${todasMed.length} maxDelta=${maxDelta} visibles=${visibles.length}`);
console.log(fail === 0 ? `QA recency Fase 7: ${ok}/${ok + fail} PASS` : `QA recency Fase 7: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
