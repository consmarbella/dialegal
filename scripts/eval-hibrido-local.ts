// eval-hibrido-local.ts — Fase I: test REAL del sistema híbrido de materia+acciones.
//
// HONESTIDAD DEL TEST (reglas fijas ANTES de correr):
// 1. Las expectativas de TODOS los casos quedan fijadas en este archivo antes
//    de la primera corrida. Si un caso falla, se reporta FAIL y se arregla el
//    MOTOR (reglas/engine), nunca la expectativa. Cada corrida se guarda con
//    su resultado completo en evaluation/fase-i-hibrido/.
// 2. Casos: (a) el CASO REAL del dueño (demanda de construcción con cláusula
//    penal y lucro cesante por rentas de arrendamiento), (b) los 16 casos de
//    la auditoría ciega v2 (evaluation/evaluacion-ciega-v2/casos-referencia.json),
//    (c) 6 trampas nuevas con sintaxis coloquial distinta, escritas antes de
//    correr el motor.
// 3. La capa LLM de respaldo se ejecuta REAL (keys de .env) solo cuando el
//    determinista duda. No se mockea nada.
//
// Uso: npx tsx scripts/eval-hibrido-local.ts

import "dotenv/config";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const { decidirMateriaHibrida } = await import("../src/server/materiaDecision.js");
const { extraerChileno } = await import("../extractorChile.js");
const { MATERIAS } = await import("../materias.js");

// ── Clientes Gemini reales (para la capa de respaldo) ───────────────────────
const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const clients = raw.split(",").map((k) => k.trim()).filter(Boolean)
  .map((apiKey) => new GoogleGenAI({ apiKey }));

// ── (a) CASO REAL del dueño: demanda de construcción $127M ──────────────────
const CASO_REAL = `Con fecha 15 de marzo de 2025, celebró un contrato de ejecución de obra a suma alzada con la demandada para la construcción de una nave industrial y dependencias corporativas en la comuna de Lampa. El plazo de entrega se fijó en 180 días corridos, bajo apercibimiento de una multa contractual de 50 UF por cada día de atraso. La obra presentaba un avance real de apenas un 62%, abandonando la demandada los trabajos el 30 de septiembre de 2025. Asimismo, peritajes técnicos posteriores constataron fallas estructurales graves en los radieres y techumbre derivados de la negligencia en la supervisión de los subcontratistas contratados por la constructora. Responsabilidad Contractual: La demandada ha incurrido en un incumplimiento grave de las obligaciones estipuladas en los artículos 1545 y 1556 del Código Civil, al no entregar la obra en el plazo convenido y presentar vicios constructivos. Responsabilidad por el Hecho del Dependiente: Conforme al artículo 2320 del Código Civil, la constructora responde directamente por las negligencias de sus subcontratistas y personal en obra. Daño Emergente: $85.000.000.- por concepto de reparaciones estructurales y término de obra con un tercero. Lucro Cesante: $42.000.000.- por rentas de arrendamiento no percibidas durante los meses de paralización. Multa Contractual: 1.500 UF acumuladas a la fecha.`;

// ── (c) TRAMPAS NUEVAS: sintaxis coloquial, escritas ANTES de correr ────────
const TRAMPAS = [
  {
    id: "T1-choque-rotonda",
    esperado: "transito",
    secundariaNo: ["civil", "penal", "laboral"],
    relato: "Me chocaron por atrás en la rotonda de Américo Vespucio con Vespucio Norte. El otro conductor venía con el celular en la mano y frenó tarde. Mi auto quedó con el parachoques destruido y el carabinero que llegó al lugar levantó el parte correspondiente.",
    notas: "tránsito genuino con palabra 'conductor' en contexto vehicular",
  },
  {
    id: "T2-multa-familia",
    esperado: "familia",
    secundariaNo: ["transito", "civil", "administrativo"],
    relato: "El juez de familia me advirtió en la audiencia que si sigo atrasando la pensión de alimentos de mi hijo me puede aplicar una multa por cada mes de atraso, y que eso se acumula.",
    notas: "'multa' en contexto de familia: NO debe disparar tránsito",
  },
  {
    id: "T3-multa-construccion-coloquial",
    esperado: "civil",
    secundariaNo: ["transito"],
    noAcciones: ["tránsito"],
    relato: "La constructora me reclamó una multa de 300 UF por atraso en la entrega del departamento que compré en San Bernardo. Yo creo que el atraso fue culpa de ellos porque cambiaron los planos dos veces. ¿Puedo pelear esa multa?",
    notas: "'multa' coloquial en construcción: civil, NO tránsito; acción multa-tránsito NO debe aparecer",
  },
  {
    id: "T4-sueldo-inspeccion",
    esperado: "laboral",
    secundariaNo: ["transito", "penal"],
    noAcciones: ["monitorio", "tránsito"],
    relato: "En la empresa no nos pagaron el sueldo de agosto completo. El jefe dijo en la reunión que si reclamamos a la Inspección del Trabajo nos va a despedir a todos de una vez. Son 22 trabajadores afectados.",
    notas: "laboral puro: sin monitorio, sin tránsito",
  },
  {
    id: "T5-tag-municipalidad",
    esperado: "transito",
    secundariaNo: ["civil", "penal"],
    siAccion: ["tránsito"],
    relato: "Debo la multa del TAG de hace dos años y ahora la municipalidad no me renovó el permiso de circulación del auto. Me dijeron que mientras no pague no puedo sacar el permiso.",
    notas: "tránsito genuino con 'municipalidad': admin NO debe ganar ni ser secundaria fuerte; acción multa-tránsito SÍ debe aparecer",
  },
  {
    id: "T6-desahucio-local",
    esperado: "civil",
    secundariaNo: ["transito", "laboral"],
    siAccion: ["desahucio"],
    relato: "Arrendé un local comercial en Providencia y el inquilino lleva 6 meses sin pagar la renta. Le envié la carta de desahucio por correo certificado pero sigue ocupando el local con su negocio. Quiero que lo restituyan.",
    notas: "arrendamiento genuino: la acción desahucio SÍ debe aparecer (control positivo del extractor)",
  },
];

// ── (b) Cargar los 16 casos v2 ───────────────────────────────────────────────
interface CasoV2 { id: string; areaEsperada: string; relato: string }
const v2path = path.join("evaluation", "evaluacion-ciega-v2", "casos-referencia.json");
const casosV2: CasoV2[] = JSON.parse(fs.readFileSync(v2path, "utf-8"));

// ── Casos donde el relato NO justifica acciones de arrendamiento/monitorio ──
const RELATO_CON_ARRIENDO_DISPUTA = /arriend|arrend|inquilin|renta|local comercial/i;

interface Resultado {
  id: string;
  esperado: string;
  obtenido: string | null;
  origen: string;
  secundaria: string | null;
  acciones: string[];
  problemas: string[];
  llm: boolean;
}

async function evaluar(
  id: string, relato: string, esperado: string,
  opts: { secundariaNo?: string[]; noAcciones?: string[]; siAccion?: string[] } = {},
): Promise<Resultado> {
  const problemas: string[] = [];
  const r = await decidirMateriaHibrida(null, relato, clients.length ? clients : undefined);
  const ext = extraerChileno(relato);
  const obtenido = r.slug ?? "indeterminada";
  const secundaria = r.materiaSecundaria ?? null;
  const llm = r.origen === "llm";

  if (obtenido !== esperado) {
    problemas.push(`materia: esperada "${esperado}", obtenida "${obtenido}" (origen ${r.origen}; scores: ${r.clasificacion.scores.map((s) => `${s.slug}=${s.puntos}`).join(", ") || "ninguno"})`);
  }
  const sec = secundaria ? secundaria : null;
  if (sec && opts.secundariaNo?.includes(sec)) {
    problemas.push(`secundaria fantasma: "${sec}" en un caso ${esperado} (scores: ${r.clasificacion.scores.map((s) => `${s.slug}=${s.puntos}`).join(", ")})`);
  }
  for (const na of opts.noAcciones ?? []) {
    if (ext.acciones.some((a) => a.toLowerCase().includes(na.toLowerCase()))) {
      problemas.push(`acción falsa: contiene "${na}" → [${ext.acciones.join(" | ")}]`);
    }
  }
  for (const sa of opts.siAccion ?? []) {
    if (!ext.acciones.some((a) => a.toLowerCase().includes(sa.toLowerCase()))) {
      problemas.push(`acción esperada faltante: "${sa}" → acciones=[${ext.acciones.join(" | ")}]`);
    }
  }
  // Regla general de la Fase I (todos los casos): el monitorio de arrendamiento
  // solo es legítimo si el relato disputa un arriendo; la multa de tránsito
  // solo si el relato es de tránsito.
  if (esperado !== "civil" || !RELATO_CON_ARRIENDO_DISPUTA.test(relato)) {
    if (esperado !== "transito" && ext.acciones.some((a) => /monitorio/i.test(a))) {
      problemas.push(`acción monitorio sin disputa de arriendo en el relato`);
    }
  }
  if (esperado !== "transito" && ext.acciones.some((a) => /tránsito/i.test(a))) {
    problemas.push(`acción multa/infracción de tránsito en un caso ${esperado}`);
  }

  return { id, esperado, obtenido, origen: r.origen, secundaria: sec, acciones: ext.acciones, problemas, llm };
}

async function main() {
  const resultados: Resultado[] = [];
  const fallos: Resultado[] = [];

  // (a) Caso real
  console.log("=== (a) CASO REAL (demanda de construcción) ===");
  const rr = await evaluar("REAL-construccion", CASO_REAL, "civil", {
    secundariaNo: ["transito", "laboral", "penal", "administrativo"],
    noAcciones: ["monitorio", "tránsito", "subsidiaria"],
  });
  resultados.push(rr);

  // (b) 16 casos v2
  console.log("=== (b) 16 CASOS AUDITORÍA v2 ===");
  for (const c of casosV2) {
    const opts: { secundariaNo?: string[] } = {};
    if (c.areaEsperada !== "transito") opts.secundariaNo = ["transito"];
    const r = await evaluar(c.id, c.relato, c.areaEsperada, opts);
    resultados.push(r);
  }

  // (c) trampas
  console.log("=== (c) 6 TRAMPAS NUEVAS ===");
  for (const t of TRAMPAS) {
    const r = await evaluar(t.id, t.relato, t.esperado, {
      secundariaNo: t.secundariaNo,
      noAcciones: t.noAcciones,
      siAccion: t.siAccion,
    });
    resultados.push(r);
  }

  // ── Reporte ────────────────────────────────────────────────────────────────
  for (const r of resultados) {
    if (r.problemas.length) fallos.push(r);
    const estado = r.problemas.length ? "❌ FAIL" : "✅ PASS";
    const llmTag = r.llm ? " [LLM]" : "";
    console.log(`[${r.id}] ${estado}${llmTag} | esperada=${r.esperado} obtenida=${r.obtenido} (origen ${r.origen})${r.secundaria ? ` secundaria=${r.secundaria}` : ""} | acciones=[${r.acciones.join(" | ") || "-"}]`);
    for (const p of r.problemas) console.log(`    ↳ ${p}`);
  }

  const resumen = {
    total: resultados.length,
    pass: resultados.length - fallos.length,
    fail: fallos.length,
    porOrigen: resultados.reduce<Record<string, number>>((acc, r) => {
      acc[r.origen] = (acc[r.origen] || 0) + 1; return acc;
    }, {}),
    materiasCorrectas: resultados.filter((r) => r.obtenido === r.esperado).length,
    secundariasTotal: resultados.filter((r) => r.secundaria).length,
    secundariasTransitoEnNoTransito: resultados.filter((r) => r.secundaria === "transito" && r.esperado !== "transito").length,
    accionesMonitorioFalso: resultados.filter((r) => r.problemas.some((p) => p.includes("monitorio"))).length,
    accionesTransitoFalso: resultados.filter((r) => r.problemas.some((p) => p.includes("tránsito"))).length,
  };
  console.log("\n=== RESUMEN ===");
  console.log(JSON.stringify(resumen, null, 2));

  const outDir = path.join("evaluation", "fase-i-hibrido");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.writeFileSync(path.join(outDir, `resultados-${stamp}.json`), JSON.stringify({ resumen, resultados }, null, 2));
  console.log(`Guardado: evaluation/fase-i-hibrido/resultados-${stamp}.json`);

  if (fallos.length) {
    console.error(`\n${fallos.length}/${resultados.length} casos con FAIL. Ver detalle arriba.`);
    process.exit(1);
  }
  console.log(`\n${resultados.length}/${resultados.length} PASS.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
