// QA Fase 5: corpus completo por area (CORPUS_COMPLETO=true) en jurisprudenciaChile.
// Determinista, sin red. El test con gate OFF corre PRIMERO porque las caches por
// area persisten por proceso (el gate solo se re-evalua antes de cachear).
process.env.CORPUS_COMPLETO = "";
const fs = await import("fs");
const path = await import("path");

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS${data !== undefined ? ` ${JSON.stringify(data).slice(0, 200)}` : ""}`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "").slice(0, 250)}`); }
}

const DIR = path.join(process.cwd(), "data", "corpus-full");
const SLUGS = ["laboral", "civil", "familia", "penal", "administrativo", "constitucional", "transversal"];
// 1. los 7 archivos existen y tienen fichas
for (const s of SLUGS) {
  const p = path.join(DIR, `${s}.json`);
  if (fs.existsSync(p)) {
    const c = JSON.parse(fs.readFileSync(p, "utf-8"));
    chk(`1 archivo ${s}.json`, Array.isArray(c.fichas) && c.fichas.length > 0, { fichas: c.fichas.length });
  } else {
    chk(`1 archivo ${s}.json`, false, "ausente");
  }
}

const penal = JSON.parse(fs.readFileSync(path.join(DIR, "penal.json"), "utf-8"));
const instPenal = new Set(penal.fichas.map((f: any) => f.institucion));
const laboral = JSON.parse(fs.readFileSync(path.join(DIR, "laboral.json"), "utf-8"));
const instLaboralFull = new Set(laboral.fichas.map((f: any) => f.institucion));

const laboralesBase = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "jurisprudencia-laboral.json"), "utf-8"));
const instBase = new Set(laboralesBase.fichas.map((f: any) => f.institucion));

const jurid = await import("../jurisprudenciaChile.js");
const qPenal = "Se interpuso querella por estafa contra el imputado. Se solicita prision preventiva y medidas cautelares. Formalizacion de la investigacion penal ante el Tribunal de Garantia.";
const qLaboral = "Despido injustificado. Contrato de 15 meses. Se deben horas extra y 3 meses de remuneracion. Tutela laboral y condena al pago de indemnizacion por anos de servicio.";

// 2. gate OFF: el slug extra es inerte -> TO OD resultado proviene de la base laboral
const rGateOff = await jurid.buscarJurisprudencia([qPenal], 8, "penal");
chk("2 con gate OFF solo sale la base laboral", rGateOff.length === 0 || rGateOff.every((r) => instBase.has(r.institucion)), { n: rGateOff.length, fuera: rGateOff.filter((r) => !instBase.has(r.institucion)).map((r) => r.institucion.slice(0, 40)) });

// 3. gate ON: consulta penal con slug penal -> aporta fichas del archivo penal
(process.env as any).CORPUS_COMPLETO = "true";
const t0 = Date.now();
const rPenal = await jurid.buscarJurisprudencia([qPenal], 8, "penal");
chk("3 busqueda penal devuelve resultados", rPenal.length >= 3, { ms: Date.now() - t0, n: rPenal.length, top: rPenal[0] && rPenal[0].materia });
chk("3b el archivo penal aporta fichas que la base no tenia", rPenal.some((r) => instPenal.has(r.institucion)), { inst: rPenal.slice(0, 5).map((r) => r.institucion.slice(0, 40)) });

// 4. slug no soportado -> solo base (no rompe)
const rBase = await jurid.buscarJurisprudencia([qPenal], 8, "slug-inexistente");
chk("4 slug invalido degrada a base sin error", Array.isArray(rBase), { n: rBase.length });

// 5. camino laboral sigue funcionando con slug
const rLaboral = await jurid.buscarJurisprudencia([qLaboral], 8, "laboral");
chk("5 laboral con corpus completo sigue dando resultados", rLaboral.length >= 2, { n: rLaboral.length, top: rLaboral[0] && rLaboral[0].materia && rLaboral[0].materia.slice(0, 50) });

// 6. transversal aporta resultados judiciales/procesales en cualquier area
const rTrans = await jurid.buscarJurisprudencia(["Recurso de proteccion contra municipalidad por acto administrativo ilegal y ordenanza"], 8, "administrativo");
chk("6 area administrativa (40 fichas) + transversal no queda vacia", rTrans.length >= 1, { n: rTrans.length, top: rTrans[0] && rTrans[0].institucion.slice(0, 50) });

console.log(fail === 0 ? `\nQA corpus completo Fase 5: ${ok}/${ok + fail} PASS` : `\nQA corpus completo Fase 5: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
