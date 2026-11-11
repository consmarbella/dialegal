// eval-nucleo.ts — evalúa el núcleo tipado (extraerCaso + decidirVia) contra
// casos con respuesta esperada. Ubicación en el repo: scripts/eval-nucleo.ts
//
// Uso:
//   npx tsx scripts/eval-nucleo.ts              # solo los casos de evaluation/nucleo/cases.jsonl
//   npx tsx scripts/eval-nucleo.ts --dorado     # además, la materia en evaluation/dorado-materias.jsonl
//   npx tsx scripts/eval-nucleo.ts --limit 5    # solo los primeros 5 casos de cada archivo
//
// Requiere GEMINI_API_KEYS (o GEMINI_API_KEY) en .env. Llama al modelo REAL,
// así que consume cuota: 12 casos = 12 llamadas; con --dorado, ~48.
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
const casos = leerJsonl(path.join(process.cwd(), "evaluation", "nucleo", "cases.jsonl")).slice(0, limite);
const filas: Fila[] = [];
const contadores: Record<string, { ok: number; total: number }> = {};
const marca = (campo: string, ok: boolean) => {
  contadores[campo] ??= { ok: 0, total: 0 };
  contadores[campo].total++;
  if (ok) contadores[campo].ok++;
};
let advertenciasTotales = 0;
let casosSinExtraccion = 0;

for (const c of casos) {
  const esp = c.esperado || {};
  const hoy = new Date(`${c.hoy || "2026-11-11"}T12:00:00`);
  const { caso, advertencias } = await extraerCaso(clients, c.texto);
  const fallos: string[] = [];

  if (!caso) {
    casosSinExtraccion++;
    filas.push({ id: c.id, ok: false, fallos: ["extraerCaso devolvió null (esquema inválido, cuota o timeout)"], obtenido: null, advertencias });
    console.log(`✗ ${c.id}  (sin extracción)`);
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
  if ("materia" in esp) comparar("materia", caso.materia === esp.materia, `esperado ${esp.materia}, obtuvo ${caso.materia}`);
  if ("estado" in esp) comparar("estado", decision.estado === esp.estado, `esperado ${esp.estado}, obtuvo ${decision.estado}`);
  if ("via" in esp) comparar("via", decision.via === esp.via, `esperado ${esp.via}, obtuvo ${decision.via}`);
  if ("montos" in esp) comparar("montos", mismoConjunto(montos, esp.montos), `esperado [${esp.montos}], obtuvo [${[...new Set(montos)]}]`);
  if ("rut" in esp) comparar("rut", mismoConjunto(ruts, esp.rut), `esperado [${esp.rut}], obtuvo [${ruts}]`);
  if ("rit" in esp) comparar("rit", (caso.estadoProcesal.rit ?? null) === esp.rit, `esperado ${esp.rit}, obtuvo ${caso.estadoProcesal.rit}`);
  if ("causaIniciada" in esp) comparar("causaIniciada", caso.estadoProcesal.causaIniciada === esp.causaIniciada, `esperado ${esp.causaIniciada}, obtuvo ${caso.estadoProcesal.causaIniciada}`);

  filas.push({
    id: c.id,
    ok: fallos.length === 0,
    fallos,
    obtenido: { materia: caso.materia, estado: decision.estado, via: decision.via, montos, ruts, rit: caso.estadoProcesal.rit, causaIniciada: caso.estadoProcesal.causaIniciada },
    advertencias,
  });
  console.log(`${fallos.length === 0 ? "✓" : "✗"} ${c.id}${fallos.length ? "\n    " + fallos.join("\n    ") : ""}${advertencias.length ? `\n    (verificador eliminó ${advertencias.length} dato(s) no respaldados por el texto)` : ""}`);
  await sleep(PAUSA_MS);
}

// ── 2) Materia sobre el set dorado existente (opcional) ─────────────────────
const dorado: Array<{ id: string; ok: boolean; esperado: string[]; obtenido: string | null }> = [];
if (conDorado) {
  const dcasos = leerJsonl(path.join(process.cwd(), "evaluation", "dorado-materias.jsonl"))
    .filter((j) => Array.isArray(j.esperado) && typeof j.texto === "string")
    .slice(0, limite);
  for (const j of dcasos) {
    const { caso } = await extraerCaso(clients, j.texto);
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
console.log(`datos eliminados por el verificador (señal de alucinación del LLM): ${advertenciasTotales}`);
console.log("Nota: el verificador ya limpia montos/RUT/citas inventados; este número mide cuántas veces el LLM los inventó.");

const dir = path.join(process.cwd(), "evaluation", "nucleo");
fs.mkdirSync(dir, { recursive: true });
const archivo = path.join(dir, `resultados-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(archivo, JSON.stringify({ contadores, casosSinExtraccion, advertenciasTotales, filas, dorado }, null, 2));
console.log(`\nResultado completo guardado en ${archivo}`);
