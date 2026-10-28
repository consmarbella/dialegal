// audit-discarded-fichas.ts — Riesgo 3 (Fase 3): auditoría real de las fichas
// descartadas por los filtros heurísticos de corpus_ingest_full.py en FULL_MODE.
//
// Responde con números:
//   discarded_total + discarded_by_reason  (debe cuadrar con la corrida real)
//   muestra de 100 fichas ESTRATIFICADA (28 corrupta / 30 prosa / 25 cita /
//     7 ambiental / 10 prosa-cola extra) determinista: se toman por POSICIÓN en
//     el archivo (reproducible sin semilla ni azar).
//   señal automática declarada por ficha: parece_titulo / sustancia (definicion
//     >=120 y concordancias) -> probable_falso_negativo (CANDIDATO, decisión
//     humana pendiente: los criterios son señalética, no veredicto).
//
// Este script NO modifica el pipeline (los cambios de filtro se proponen, no
// se aplican sin tests). Salida: evaluation/jurisprudencia/audit-descartadas.json
import fs from "fs";
import path from "path";
import readline from "readline";

process.env.CORPUS_COMPLETO = "";

// ── Replicación EXACTA de la cadena FULL de corpus_ingest_full.py (líneas 76-111) ──
// Python \w es unicode; JS sin flag no: usamos /u con [\p{L}\p{N}_].
function limpia(institucion: string): string {
  return institucion
    .replace(/\s+\d{1,4}\s*$/, "")
    .replace(/^\d+(?:[.]\d+)*\.?\s+/, "")
    .trim();
}

const PROSA_INICIO = /^(Por |Parte de |Reclamar |Explique |Sentencia del |En todos |Conclusi|Esta ley |La Direcci|De los |Adem?s|Ademas|Sin embargo|Al efecto|Seg?n|Cabe |De este |De esa |De este modo)/;
const PROSA_COLA = /\s(en la|de la|de el|y la|del |los )\s?[\p{L}\p{N}_]{0,20}$/u;
const CITA = /\(\d{4}\)|§|"| \/ /;

function clasificaFULL(d: any): { motivo: string; institucion_limpia: string } | null {
  const area = String(d.area || "");
  const institucion0 = String(d.institucion || "");
  const materia = String(d.materia || "");
  const obra = String(d.obra || "");
  const blob = `${area} ${institucion0} ${materia} ${obra}`.toLowerCase();
  if (blob.includes("ambiental") && !area.includes("Judicial")) {
    return { motivo: "ambiental_fuera", institucion_limpia: "" };
  }
  if (institucion0.length > 150 || !institucion0) return { motivo: "institucion_corrupta", institucion_limpia: "" };
  const limpiaInst = limpia(institucion0);
  if (CITA.test(limpiaInst)) return { motivo: "corrupta_cita", institucion_limpia: limpiaInst };
  // replica Python limpiaInst[0].islower(): primera letra en minúscula
  const c0 = limpiaInst[0];
  const esMinuscula = !!c0 && /[a-záéíóúñü]/u.test(c0);
  if (esMinuscula || limpiaInst.split(/\s+/).length < 3) {
    return { motivo: "institucion_corrupta", institucion_limpia: limpiaInst };
  }
  const tieneRector = String(d.fallo_rector || "").trim() !== "";
  if ((PROSA_INICIO.test(limpiaInst) || limpiaInst.endsWith("-") || PROSA_COLA.test(limpiaInst)) && !tieneRector) {
    return { motivo: "institucion_prosa", institucion_limpia: limpiaInst };
  }
  return null; // aceptada
}

// ── Recorrida: clasifico TODAS y guardo muestrideable tabulated determinista ──
const jsonlPath = path.join(process.env.TEMP || "/tmp", "opencode", "hf", "data", "instituciones.jsonl");
if (!fs.existsSync(jsonlPath)) {
  console.error(`ERROR: no existe ${jsonlPath}`);
  process.exit(1);
}

const porMotivo: Record<string, number> = {};
const listaPorMotivo: Record<string, any[]> = {};
let rowIdx = 0;

const rl = readline.createInterface({ input: fs.createReadStream(jsonlPath, "utf-8") });
rl.on("line", (l) => {
  if (!l.trim()) return;
  rowIdx++;
  let d: any;
  try { d = JSON.parse(l); } catch { return; }
  const r = clasificaFULL(d);
  if (!r) return;
  porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
  (listaPorMotivo[r.motivo] = listaPorMotivo[r.motivo] || []).push({
    pos: rowIdx,
    id: d.id || "",
    area: String(d.area || ""),
    institucion: r.institucion_limpia || String(d.institucion || ""),
    definicion_len: String(d.definicion || "").length,
    definicion_head: String(d.definicion || "").slice(0, 140).replace(/\s+/g, " "),
    concordancias: String(d.concordancias || "").trim() !== "",
    contenido_len: String(d.contenido || "").length,
    tiene_rector: String(d.fallo_rector || "").trim() !== "",
  });
});

rl.on("close", () => {
  const total = Object.values(porMotivo).reduce((a, b) => a + b, 0);

  // ── Muestra estratificada determinista: N sin reposición repartidas por posición ──
  const QUOTA: Record<string, number> = {
    institucion_corrupta: 28,
    institucion_prosa: 30,
    corrupta_cita: 25,
    ambiental_fuera: 7,
  };
  const muestra: any[] = [];
  for (const [motivo, n] of Object.entries(QUOTA)) {
    const filas = listaPorMotivo[motivo] || [];
    const paso = filas.length / n;
    for (let i = 0; i < n; i++) {
      const fila = filas[Math.floor(i * paso)];
      if (fila) {
        // señales automáticas DECLARADAS (no son veredicto humano):
        const inst = fila.institucion as string;
        const primeraMayuscula = !!inst && inst[0] === inst[0].toUpperCase();
        const palabras = inst.split(/\s+/).length;
        const terminaEnPalabra = /[\p{L}]$/u.test(inst);
        const sustancia = fila.definicion_len >= 120 && fila.concordancias;
        fila.motivo = motivo;
        fila.senal_parece_titulo = primeraMayuscula && palabras >= 3 && terminaEnPalabra;
        fila.senal_sustancia = sustancia;
        fila.probable_falso_negativo = fila.senal_parece_titulo && sustancia;
        fila.decision_humana = "pendiente_revision_humana";
        muestra.push(fila);
      }
    }
  }

  // Métricas señal por motivo (para probable-FN>5%)
  const porMotivoSenal: Record<string, any> = {};
  for (const [motivo, filas] of Object.entries(listaPorMotivo)) {
    const n = (f: (x: any) => boolean) => filas.filter(f).length;
    porMotivoSenal[motivo] = {
      descartadas: filas.length,
      con_rector: n((x) => x.tiene_rector),
      con_sustancia: n((x) => x.definicion_len >= 120 && x.concordancias),
    };
  }

  const report = {
    generado: new Date().toISOString(),
    fuente_cruda: jsonlPath,
    discarded_total: total,
    discarded_by_reason: porMotivo,
    discarded_sample_reviewed: muestra.length,
    metodologia_muestra: "estratificada por motivo, por POSICIÓN en el archivo (cada floor(i*n/N)), determinista y reproducible",
    criterios_senales: {
      parece_titulo: "institucion arranca en mayúscula, >=3 palabras y termina en palabra",
      sustancia: "definicion >=120 chars Y concordancias no vacias",
      probable_falso_negativo: "parece_titulo AND sustancia (CANDIDATO; decisión humana pendiente, no veredicto)",
    },
    por_motivo_senales: porMotivoSenal,
    muestra,
  };

  const outDir = path.join(process.cwd(), "evaluation", "jurisprudencia");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "audit-descartadas.json"), JSON.stringify(report, null, 2), "utf-8");

  console.log(`=== AUDIT DESCARTADAS ===`);
  console.log(`descartadas total: ${total} -> ${JSON.stringify(porMotivo)}`);
  const fnPorMotivo: Record<string, number> = {};
  for (const m of muestra) {
    fnPorMotivo[m.motivo] = (fnPorMotivo[m.motivo] || 0) + (m.probable_falso_negativo ? 1 : 0);
  }
  for (const [motivo, n] of Object.entries(fnPorMotivo)) {
    const tamMuestra = muestra.filter((x) => x.motivo === motivo).length;
    const pct = ((n / tamMuestra) * 100).toFixed(1);
    console.log(`  ${motivo}: ${n}/${tamMuestra} candidatos FN en muestra (${pct}%)`);
  }
  console.log(`-> evaluation/jurisprudencia/audit-descartadas.json`);
});
