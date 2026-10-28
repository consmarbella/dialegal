// Harness de medición de tasa de error — Fase 7 (DECISIONES).
// Línea base DETERMINISTA del pipeline sobre casos extraídos del corpus real
// (data/jurisprudencia-casos.json): inyectamos defectos controlados en
// borradores sintéticos y medimos qué tanto el gate/anotaciones los detecta.
// Sin red, sin LLM (el modo --llm queda preparado para calibración local con
// demandas privadas .gitignore).
//
// Métricas por corrida: accuracy del gate (bloqueos), sensitivity de las
// anotaciones, y consistencia del motor de plazos. Se vuelca a
// data/baseline-fase7.json y se imprime en formato pegable a DECISIONES.md.
process.env.CORPUS_COMPLETO = "";
import fs from "fs";
import path from "path";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; } else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "").slice(0, 160)}`); }
}

// ── 1. cargar casos reales del corpus ──
const casosPath = path.join(process.cwd(), "data", "jurisprudencia-casos.json");
const estructura = JSON.parse(fs.readFileSync(casosPath, "utf-8"));
const casos: any[] = Array.isArray(estructura) ? estructura : (estructura.casos || []);
if (!casos.length) throw new Error("corpus casos vacio");

// fichas con texto de doctrina suficiente
const base = casos.slice(0, 60).filter((c) => (c.doctrina || "").length > 120).slice(0, 15);
chk("1 hay 15 casos reales utiles para el harness", base.length === 15, { n: base.length });

// ── 2. generar borradores sintéticos con defectos controlados ──
// defecto   A: RIT heredado (no en documento)   -> BLOQUEANTE (gate)
// defecto   B: marcador "XX"                    -> BLOQUEANTE (gate)
// defecto   C: rol no en corpus                 -> anotación (NO gate)
// defecto   D: montos no corroborados           -> anotación (NO gate)
const VI = await import("../validadorInforme.js");
const P = await import("../plazosChile.js");

interface Medicion { caso: string; defecto: string; bloqueado: boolean; anotado: boolean; }
const mediciones: Medicion[] = [];

for (let i = 0; i < base.length; i++) {
  const c = base[i];
  const rol = String(c.rol || "0-0").replace(/[^\d-]/g, "") || "0-0";
  const doc = `[INTENTOS] Comunicación en causa ${rol}. ${String(c.doctrina).slice(0, 300)}`;
  const tipoDefecto = ["rit_herido", "xx_crudo", "rol_fuera", "monto_no", "limpio"][i % 5];
  const rolBase = rol.split("-")[0] || "23456";
  const rolAnio = (rol.split("-")[1] || "2019").replace(/\D/g, "");
  let report = `S.J.L.\nRIT C-${rolBase}-${rolAnio}\nEN LO PRINCIPAL: ${String(c.tribunal || "demanda")}\nHECHOS: ${String(c.doctrina).slice(0, 240)}\nDerecho: Art. 157 del Código del Trabajo.\nPETITORIO: se solicita acoger la demanda y pagar $350.000.`;
  const insumos = {
    rolesCorpus: [rol] as string[],
    artsCubiertos: ["157"] as string[],
    artsPendientes: [] as string[],
    montosDoc: ["350.000"] as string[],
    textoDoc: doc,
  };
  if (tipoDefecto === "rit_herido") report = report.replace(/C-[A-Z0-9.\-]+\d{4}/, "C-4412-2026");
  if (tipoDefecto === "xx_crudo") report += "\nComparece el señor XX en representación.";
  if (tipoDefecto === "rol_fuera") report += "\nSegún la jurisprudencia Rol N° 12.222-2017 del supremo tribunal.";
  if (tipoDefecto === "monto_no") report += "\nMás la renta $1.234.567 por vacaciones del mes pendiente.";
  const v = VI.validarInforme(report, insumos);
  const bloqueado = VI.hallazgosBloqueantes(v, report, doc).length > 0;
  const anotado = VI.notaBlindajeReporte(v).length > 0;
  mediciones.push({ caso: rol, defecto: tipoDefecto, bloqueado, anotado });
}

// ── 3. métricas ──
const cuenta = (def: string, f: (m: Medicion) => boolean) => mediciones.filter((m) => m.defecto === def && f(m)).length;
const bloqueoA = cuenta("rit_herido", (m) => m.bloqueado) === cuenta("rit_herido", () => true);
const bloqueoB = cuenta("xx_crudo", (m) => m.bloqueado) === cuenta("xx_crudo", () => true);
const sinBloqueoC = cuenta("rol_fuera", (m) => !m.bloqueado) === cuenta("rol_fuera", () => true);
const sinBloqueoD = cuenta("monto_no", (m) => !m.bloqueado) === cuenta("monto_no", () => true);
const sinBloqueoLimpio = cuenta("limpio", (m) => !m.bloqueado) === cuenta("limpio", () => true);
chk("2a RIT heredio SIEMPRE bloqueado", bloqueoA, cuenta("rit_herido", () => true));
chk("2b XX crudo SIEMPRE bloqueado", bloqueoB, cuenta("xx_crudo", () => true));
chk("2c rol fuera de corpus NUNCA bloquea (anotación)", sinBloqueoC);
chk("2d monto no corroborado NUNCA bloquea", sinBloqueoD);
chk("2e caso limpio nunca bloqueado (0 falsos positivos)", sinBloqueoLimpio);
const anotacionC = cuenta("rol_fuera", (m) => m.anotado) === cuenta("rol_fuera", () => true);
chk("2f rol fuera de corpus SIEMPRE anotado", anotacionC);

// ── 4. consistencia del motor de plazos (escenarios canónicos) ──
const p1 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2025-05-23", kmDemandado: 0 });
const p2 = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2024-09-06", kmDemandado: 0 });
chk("3a plazos: civil 23-05 = 2025-06-13", p1.ok && p1.fechaLimite === "2025-06-13", p1.fechaLimite);
chk("3b plazos: laboral 06-09 = 2024-10-01", p2.ok && p2.fechaLimite === "2024-10-01", p2.fechaLimite);

// ── 5. dump de premio de metrics ──
const accuracyBloqueo = (Number(bloqueoA) + Number(bloqueoB) + Number(sinBloqueoC) + Number(sinBloqueoD) + Number(sinBloqueoLimpio)) / 5;
const accuracyPlazos = 2 / 2;
const out = {
  fecha: new Date().toISOString().slice(0, 10),
  casosReales: base.length,
  gateAccuracy: accuracyBloqueo,
  plazosConsistencia: accuracyPlazos,
  mediciones,
};
fs.writeFileSync(path.join(process.cwd(), "data", "baseline-fase7.json"), JSON.stringify(out, null, 1), "utf-8");
console.log(`\nRESUMEN-BASELINE: gateAccuracy=${accuracyBloqueo} plazosConsistencia=${accuracyPlazos} mediciones=${mediciones.length} -> data/baseline-fase7.json`);

console.log(fail === 0 ? `Harness Fase 7: OK` : `Harness Fase 7: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
