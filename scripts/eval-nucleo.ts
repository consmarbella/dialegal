// eval-nucleo.ts — evalúa el núcleo tipado (extraerCaso + decidirVia) contra
// casos con respuesta esperada. Ubicación en el repo: scripts/eval-nucleo.ts
//
// Uso:
//   npx tsx scripts/eval-nucleo.ts              # cases.jsonl + cases-todas-materias.jsonl
//   npx tsx scripts/eval-nucleo.ts --dorado     # además, la materia en evaluation/dorado-materias.jsonl
//   npx tsx scripts/eval-nucleo.ts --limit 5    # solo los primeros 5 casos de cada archivo
//
// Requiere GEMINI_API_KEYS (o GEMINI_API_KEY) en .env. Llama al modelo REAL,
// así que consume cuota: ~34 casos = ~34 llamadas; con --dorado, ~80.
//
// Reglas de honestidad (iguales a las de los otros scripts eval-*):
// - Las expectativas se fijan en los .jsonl ANTES de correr. Si un caso falla,
//   se arregla el motor, nunca la expectativa.
// - Cada corrida se guarda completa en evaluation/nucleo/resultados-<fecha>.json.
// - Solo se compara lo que el caso declara en "esperado": una clave ausente no se evalúa.

import "dotenv/config";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const { extraerCaso } = await import("../src/server/extraerCaso.js");
const { decidirVia } = await import("../src/server/viasProcesales.js");

const args = process.argv.slice(2);
const conDorado = args.includes("--dorado");
const iLimit = args.indexOf("--limit");
const limite = iLimit >= 0 ? Math.max(1, parseInt(args[iLimit + 1] || "0", 10) || 0) : Infinity;

const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const clients = raw.split(",").map((k) => k.trim().replace(/^"|"$/g, "")).filter(Boolean)
  .map((apiKey) => new GoogleGenAI({ apiKey }));
if (!clients.length) {
  console.error("Falta GEMINI_API_KEYS / GEMINI_API_KEY en .env");
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PAUSA_MS = 3000; // respeta el rate limit por minuto del free-tier

function leerJsonl(ruta: string): any[] {
  if (!fs.existsSync(ruta)) return [];
  return fs.readFileSync(ruta, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const mismoConjunto = (a: Array<string | number>, b: Array<string | number>) => {
  const A = [...new Set(a)].map(String).sort();
  const B = [...new Set(b)].map(String).sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};

interface Fila {
  id: string;
  ok: boolean;
  fallos: string[];
  obtenido: any;
  advertencias: string[];
}

// ── 1) Casos del núcleo (vía, campos, anti-alucinación) ─────────────────────
const casosNucleo = leerJsonl(path.join(process.cwd(), "evaluation", "nucleo", "cases.jsonl")).slice(0, limite);
const casosTodas = leerJsonl(path.join(process.cwd(), "evaluation", "nucleo", "cases-todas-materias.jsonl")).slice(0, limite);
const casos = [...casosNucleo, ...casosTodas];

const filas: Fila[] = [];
const contadores: Record<string, { ok: number; total: number }> = {};
const marca = (campo: string, ok: boolean) => {
  contadores[campo] ??= { ok: 0, total: 0 };
  contadores[campo].total++;
  if (ok) contadores[campo].ok++;
};
let advertenciasTotales = 0;
let casosSinExtraccion = 0;
let casosSinCorrer = 0;

// Resumen por materia
const porMateria: Record<string, { materiaOk: number; materiaTotal: number; viaOk: number; viaTotal: number }> = {};

for (const c of casos) {
  const esp = c.esperado || {};
  const hoy = new Date(`${c.hoy || "2026-11-11"}T12:00:00`);
  const { caso, advertencias, motivo } = await extraerCaso(clients, c.texto);
  const fallos: string[] = [];

  if (!caso) {
    if (motivo === "cuota") {
      casosSinCorrer++;
      filas.push({ id: c.id, ok: false, fallos: ["cuota agotada: caso no corrido"], obtenido: null, advertencias });
      console.log(`⊘ ${c.id}  (cuota agotada, no corrido)`);
      // Si la cuota se agotó, marcar los casos restantes como sin correr
      const idx = casos.indexOf(c);
      const restantes = casos.slice(idx + 1);
      for (const cRest of restantes) {
        casosSinCorrer++;
        filas.push({ id: cRest.id, ok: false, fallos: ["cuota agotada: caso no corrido"], obtenido: null, advertencias: [] });
        console.log(`⊘ ${cRest.id}  (cuota agotada, no corrido)`);
      }
      break;
    }
    casosSinExtraccion++;
    filas.push({ id: c.id, ok: false, fallos: [`extraerCaso devolvió null (motivo: ${motivo})`], obtenido: null, advertencias });
    console.log(`✗ ${c.id}  (sin extracción: ${motivo})`);
    await sleep(PAUSA_MS);
    continue;
  }

  advertenciasTotales += advertencias.length;
  const decision = decidirVia(caso, hoy);
  const montos = [...caso.documentos.map((d) => d.montoClp), ...caso.pretensiones.map((p) => p.montoClp)]
    .filter((m): m is number => typeof m === "number");
  const ruts = caso.partes.map((p) => p.rut).filter((r): r is string => !!r);

  const comparar = (campo: string, ok: boolean, detalle: string) => {
    marca(campo, ok);
    if (!ok) fallos.push(`${campo}: ${detalle}`);
  };
  if ("materia" in esp) {
    // Para casos esperados "indeterminada": acertar si materia es indeterminada
    // O si preguntas no está vacío.
    if (esp.materia === "indeterminada") {
      const okInd = caso.materia === "indeterminada" || caso.preguntas.length > 0;
      comparar("materia", okInd, `esperado indeterminada, obtuvo ${caso.materia}${caso.preguntas.length > 0 ? " (preguntas no vacío)" : ""}`);
    } else {
      comparar("materia", caso.materia === esp.materia, `esperado ${esp.materia}, obtuvo ${caso.materia}`);
    }
  }
  if ("estado" in esp) comparar("estado", decision.estado === esp.estado, `esperado ${esp.estado}, obtuvo ${decision.estado}`);
  if ("via" in esp) comparar("via", decision.via === esp.via, `esperado ${esp.via}, obtuvo ${decision.via}`);
  if ("montos" in esp) comparar("montos", mismoConjunto(montos, esp.montos), `esperado [${esp.montos}], obtuvo [${[...new Set(montos)]}]`);
  if ("rut" in esp) comparar("rut", mismoConjunto(ruts, esp.rut), `esperado [${esp.rut}], obtuvo [${ruts}]`);
  if ("rit" in esp) comparar("rit", (caso.estadoProcesal.rit ?? null) === esp.rit, `esperado ${esp.rit}, obtuvo ${caso.estadoProcesal.rit}`);
  if ("causaIniciada" in esp) comparar("causaIniciada", caso.estadoProcesal.causaIniciada === esp.causaIniciada, `esperado ${esp.causaIniciada}, obtuvo ${caso.estadoProcesal.causaIniciada}`);

  // Comparar viaPropuesta con viaContiene (si el caso lo tiene)
  if (c.viaContiene && Array.isArray(c.viaContiene) && c.viaContiene.length > 0) {
    const viaNorm = normalizar(caso.viaPropuesta || "");
    const aciertaVia = c.viaContiene.some((palabra: string) => viaNorm.includes(normalizar(palabra)));
    comparar("viaContiene", aciertaVia, `esperado alguna de [${c.viaContiene}], viaPropuesta="${caso.viaPropuesta}"`);
  }

  filas.push({
    id: c.id,
    ok: fallos.length === 0,
    fallos,
    obtenido: { materia: caso.materia, estado: decision.estado, via: decision.via, viaPropuesta: caso.viaPropuesta, montos, ruts, rit: caso.estadoProcesal.rit, causaIniciada: caso.estadoProcesal.causaIniciada, preguntas: caso.preguntas },
    advertencias,
  });
  console.log(`${fallos.length === 0 ? "✓" : "✗"} ${c.id}${fallos.length ? "\n    " + fallos.join("\n    ") : ""}${advertencias.length ? `\n    (verificador eliminó ${advertencias.length} dato(s) no respaldados por el texto)` : ""}`);
  await sleep(PAUSA_MS);

  // Resumen por materia
  const mat = c.materia || "desconocida";
  porMateria[mat] ??= { materiaOk: 0, materiaTotal: 0, viaOk: 0, viaTotal: 0 };
  porMateria[mat].materiaTotal++;
  if ("materia" in esp) {
    const matOk = esp.materia === "indeterminada"
      ? (caso.materia === "indeterminada" || caso.preguntas.length > 0)
      : caso.materia === esp.materia;
    if (matOk) porMateria[mat].materiaOk++;
  }
  if (c.viaContiene && Array.isArray(c.viaContiene) && c.viaContiene.length > 0) {
    porMateria[mat].viaTotal++;
    const viaNorm = normalizar(caso.viaPropuesta || "");
    const viaOk = c.viaContiene.some((palabra: string) => viaNorm.includes(normalizar(palabra)));
    if (viaOk) porMateria[mat].viaOk++;
  }
}

// ── 2) Materia sobre el set dorado existente (opcional) ─────────────────────
const dorado: Array<{ id: string; ok: boolean; esperado: string[]; obtenido: string | null }> = [];
if (conDorado) {
  const dcasos = leerJsonl(path.join(process.cwd(), "evaluation", "dorado-materias.jsonl"))
    .filter((j) => Array.isArray(j.esperado) && typeof j.texto === "string")
    .slice(0, limite);
  for (const j of dcasos) {
    const { caso, motivo } = await extraerCaso(clients, j.texto);
    if (!caso && motivo === "cuota") {
      casosSinCorrer++;
      console.log(`⊘ dorado ${j.id}  (cuota agotada, no corrido)`);
      break;
    }
    const obtenido = caso?.materia ?? null;
    const ok = !!obtenido && j.esperado.includes(obtenido);
    marca("materia_dorado", ok);
    dorado.push({ id: j.id, ok, esperado: j.esperado, obtenido });
    console.log(`${ok ? "✓" : "✗"} dorado ${j.id}  esperado=${j.esperado.join("|")} obtuvo=${obtenido}`);
    await sleep(PAUSA_MS);
  }
}

// ── 3) Resumen y guardado ───────────────────────────────────────────────────
console.log("\n══ RESUMEN ══");
for (const [campo, v] of Object.entries(contadores)) {
  console.log(`${campo.padEnd(16)} ${v.ok}/${v.total}  (${((100 * v.ok) / v.total).toFixed(0)}%)`);
}
console.log(`casos sin extracción: ${casosSinExtraccion}/${casos.length}`);
if (casosSinCorrer > 0) {
  console.log(`casos sin correr (cuota agotada): ${casosSinCorrer}`);
}
console.log(`datos eliminados por el verificador (señal de alucinación del LLM): ${advertenciasTotales}`);
console.log("Nota: el verificador ya limpia montos/RUT/citas inventados; este número mide cuántas veces el LLM los inventó.");

console.log("\n══ RESUMEN POR MATERIA ══");
for (const [mat, v] of Object.entries(porMateria)) {
  const matPct = v.materiaTotal > 0 ? ((100 * v.materiaOk) / v.materiaTotal).toFixed(0) : "N/A";
  const viaPct = v.viaTotal > 0 ? ((100 * v.viaOk) / v.viaTotal).toFixed(0) : "N/A";
  console.log(`${mat.padEnd(16)} materia: ${v.materiaOk}/${v.materiaTotal} (${matPct}%)  vía: ${v.viaOk}/${v.viaTotal} (${viaPct}%)`);
}

const dir = path.join(process.cwd(), "evaluation", "nucleo");
fs.mkdirSync(dir, { recursive: true });
const archivo = path.join(dir, `resultados-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(archivo, JSON.stringify({ contadores, casosSinExtraccion, casosSinCorrer, advertenciasTotales, filas, dorado, porMateria }, null, 2));
console.log(`\nResultado completo guardado en ${archivo}`);