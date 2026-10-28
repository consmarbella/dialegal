// eval-gate.ts — Fase 8-RIESGOS: calibración REAL del gate híbrido contra el
// set etiquetado evaluation/gate-calibration/cases.jsonl.
//
// Semántica derivada del sistema real (no del deseo):
//   fail  = hallazgosBloqueantes() > 0        (gate premium 422)
//   warn  = anotaciones del validador (rol fuera de corpus, art. sin cobertura
//           BCN proxy, monto no corroborado) O anotaciones de plazos
//           (fecha_notificacion_ambigua, plazo_vencido, limite_no_consignada,
//           plazo_sin_fecha_detectable)
//   pass  = ni bloqueo ni anotaciones
//
// Proxy DECLARADO en report.json: el  `artsCubiertos` de producción viene del
// canal BCN; el evaluador usa los artículos presentes en el documento fuente
// como cobertura declarada del caso (determinista, mismo regex que producción).
//
// No optimiza el gate: solo mide. Reporte -> evaluation/gate-calibration/report.json
import fs from "fs";
import path from "path";

const VI = await import("../validadorInforme.js");
const P = await import("../plazosChile.js");

process.env.CORPUS_COMPLETO = "";

interface Caso {
  id: string; materia: string; tipo_documento: string;
  texto_o_ruta_pdf_anonimizado: string; informe: string;
  fecha_notificacion?: string; fecha_base?: string; plazo_esperado?: string;
  fundamento_normativo?: string; resultado_esperado_del_gate: "pass" | "fail" | "warn";
  notas?: string; km_demandado?: number | null; motor_plazo_id?: string;
  gate_fundamento_pendiente_bcn?: boolean;
}

const jsonlPath = path.join(process.cwd(), "evaluation", "gate-calibration", "cases.jsonl");
const casos: Caso[] = fs.readFileSync(jsonlPath, "utf-8")
  .split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("//")).map((l) => JSON.parse(l));
if (casos.length < 30) throw new Error(`solo ${casos.length} casos (se exigen >= 30)`);

const ids = new Set<string>();
for (const c of casos) {
  if (!c.id || ids.has(c.id)) throw new Error(`id missing/dup @ ${c.id}`);
  ids.add(c.id);
  // Regla de aceptación: ningun pass sin fundamento y fecha base
  if (c.resultado_esperado_del_gate === "pass" && (!c.fundamento_normativo || !c.fecha_base)) {
    throw new Error(`caso pass ${c.id} sin fundamento_normativo/fecha_base`);
  }
}

interface Obtenido { id: string; clase: "pass" | "fail" | "warn"; causas: string[]; }
const obtenidos: Obtenido[] = [];
const detalle: any[] = [];
const esperadoPorId = new Map(casos.map((c) => [c.id, c.resultado_esperado_del_gate]));

for (const c of casos) {
  const doc = c.texto_o_ruta_pdf_anonimizado || "";
  const informe = c.informe || "";

  // Insumos derivados del DOCUMENTO con las mismas regex de producción:
  const rolesCorpus = VI.extraerRolesDeTexto(doc);
  const artsCubiertos = VI.extraerArtsDeTexto(doc);      // proxy BCN declarado
  const montosDoc = VI.extraerMontosDeTexto(doc);
  const insumos = { rolesCorpus, artsCubiertos, artsPendientes: [] as string[], montosDoc, textoDoc: doc };

  const v = VI.validarInforme(informe, insumos);

  // (1) Gate premium: bloqueo estructural
  const bloqueo = VI.hallazgosBloqueantes(v, informe, doc);

  // (2) Anotaciones del validador (capa warn)
  const causas: string[] = [];
  if (v.rolesNoEnCorpus.length) causas.push(`rol_fuera_corpus: ${v.rolesNoEnCorpus.join(" ")}`);
  if (v.artsSinCobertura.length) causas.push(`art_sin_cobertura_bcn_proxy: ${v.artsSinCobertura.join(" ")}`);
  if (v.montosNoCorroborados.length) causas.push(`monto_no_corroborado: ${v.montosNoCorroborados.join(" ")}`);

  // (3) Capa plazos (si el caso declara plazo esperado)
  const quierePlazo = !!c.plazo_esperado && !["-", ""].includes((c.plazo_esperado || "").trim());
  if (quierePlazo) {
    const fechas = P.detectarFechasNotificacion(doc);
    if (!fechas.primera) {
      causas.push("plazo_sin_fecha_notificacion_detectable");
    } else {
      const r = P.calcularPlazo({
        plazoId: c.motor_plazo_id || "civil_contestacion",
        fechaNotificacion: fechas.primera,
        kmDemandado: c.km_demandado == null ? null : c.km_demandado,
      });
      if (!r.ok) causas.push("motor_plazo_sin_resultado: " + (r.aviso || ""));
      else {
        const anots = P.anotacionesPlazos([r], informe, fechas);
        causas.push(...anots.map((a) => a.split(":")[0].trim()));
      }
    }
  }

  const clase: Obtenido["clase"] = bloqueo.length ? "fail" : (causas.length ? "warn" : "pass");
  obtenidos.push({ id: c.id, clase, causas: [...(bloqueo.length ? ["bloqueo_estructura: " + bloqueo.join(" | ")] : []), ...causas] });
  detalle.push({
    id: c.id, materia: c.materia, esperado: c.resultado_esperado_del_gate, obtenido: clase,
    causas, match: clase === c.resultado_esperado_del_gate,
    esperado_notas: c.notas, fecha_notificacion_caso: c.fecha_notificacion, plazo_esperado: c.plazo_esperado,
  });
}

// ── Métricas reales ──
const CLASES: Array<"pass" | "warn" | "fail"> = ["pass", "warn", "fail"];
const confusion: Record<string, Record<string, number>> = {};
for (const e of CLASES) { confusion[e] = {}; for (const o of CLASES) confusion[e][o] = 0; }
for (const o of obtenidos) confusion[(detalle.find((d) => d.id === o.id) as any).esperado][o.clase]++;

const accuracy = obtenidos.filter((o) => esperadoPorId.get(o.id) === o.clase).length / obtenidos.length;

function primRecall(clase: string) {
  let TP = 0, FP = 0, FN = 0;
  for (const o of obtenidos) {
    const expected = esperadoPorId.get(o.id);
    if (o.clase === clase && expected === clase) TP++;
    else if (o.clase === clase && expected !== clase) FP++;
    else if (o.clase !== clase && expected === clase) FN++;
  }
  return { fp: FP, fn: FN, precision: TP + FP === 0 ? 0 : TP / (TP + FP), recall: TP + FN === 0 ? 0 : TP / (TP + FN), f1: (TP / (TP + FP) + TP / (TP + FN)) === 0 ? 0 : 2 * (TP / (TP + FP)) * (TP / (TP + FN)) / ((TP / (TP + FP)) + (TP / (TP + FN))) };
}

const porClase = Object.fromEntries(
  CLASES.map((cl) => {
    const r = primRecall(cl);
    return [cl, { precision: Math.round(r.precision * 1000) / 1000, recall: Math.round(r.recall * 1000) / 1000, f1: Math.round(r.f1 * 1000) / 1000, falsos_positivos: r.fp, falsos_negativos: r.fn }];
  })
);

// Macro-avg F1
const macroF1 = CLASES.reduce((a, cl) => a + (porClase as any)[cl].f1, 0) / CLASES.length;

// Matriz por materia
const porMateria: Record<string, { total: number; ok: number; fallos: string[] }> = {};
for (const d of detalle) {
  porMateria[d.materia] = porMateria[d.materia] || { total: 0, ok: 0, fallos: [] };
  porMateria[d.materia].total++;
  if (d.match) porMateria[d.materia].ok++;
  else porMateria[d.materia].fallos.push(d.id);
}

const fallidos = detalle.filter((d) => !d.match);

const report = {
  generado: new Date().toISOString(),
  casos_total: casos.length,
  distribucion_esperada: {
    pass: casos.filter((c) => c.resultado_esperado_del_gate === "pass").length,
    warn: casos.filter((c) => c.resultado_esperado_del_gate === "warn").length,
    fail: casos.filter((c) => c.resultado_esperado_del_gate === "fail").length,
  },
  accuracy,
  macro_f1: Math.round(macroF1 * 1000) / 1000,
  por_clase: porClase,
  confusion,
  por_materia: porMateria,
  casos_fallidos: fallidos,
  metodologia: {
    fail_semantica: "hallazgosBloqueantes() > 0 (gate premium 422: RIT heredado en encabezado / marcador XX crudo)",
    warn_semantica: "anotaciones real: validador (rol fuera de corpus / art. sin cobertura BCN proxy / monto no corroborado) + anotaciones plazos (ambigua, vencido, no consignada, sin fecha)",
    proxy_bcn: "artsCubiertos del eval = articulos citados en el documento fuente (mismo regex de producción). Production BCN coverage may differ for pendientes flakiness.",
    entregables: ["cases.jsonl 35 casos >= 30 exigidos", "sin mocks: corre el sistema real (validadorInforme.ts + plazosChile.ts), no huérfanos"],
  },
  limitaciones: [
    "artsCubiertos es proxy (documento fuente) para hacer el eval determinista sin red",
    "casos polícia-local/consumidor sin plazo registrado en el motor: la capa plazos no aplica (pecho no plateau pas)",
  ],
};

const outDir = path.join(process.cwd(), "evaluation", "gate-calibration");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");
console.log(`=== EVAL GATE (calibración real, ${casos.length} casos) ===`);
console.log(`accuracy: ${(accuracy * 100).toFixed(1)}% · macro-F1: ${Math.round(macroF1 * 1000) / 1000}`);
for (const cl of CLASES) {
  const p = (porClase as any)[cl];
  console.log(`  ${cl}: precision=${p.precision} recall=${p.recall} F1=${p.f1} · FP=${p.falsos_positivos} FN=${p.falsos_negativos}`);
}
console.log(`matriz esperado->obtenido:`);
for (const e of CLASES) console.log(`  ${e}: pass=${confusion[e].pass} warn=${confusion[e].warn} fail=${confusion[e].fail}`);
if (fallidos.length) {
  console.log(`\nCASOS NO MATCH (${fallidos.length}):`);
  for (const d of fallidos) console.log(`  - ${d.id} (${d.materia}): esperado=${d.esperado} obtenido=${d.obtenido} :: ${d.causas.join(" | ").slice(0, 260)}`);
}
console.log(`\n-> evaluation/gate-calibration/report.json`);

// CI: falla si no match > tolerancia razonable (la calibración mira y mide, no
// bloquea al 100%: umbral 0.8 para gusto. Los fallos quedarán listados aún si
// la corrida es verde).
if (accuracy < 0.8) process.exit(1);
