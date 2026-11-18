// playbookLoader.ts — carga de Playbooks Procesales (data/playbooks/*.json).
//
// Un playbook es la estructura obligatoria + táctica de un cruce
// [Materia + Rol + Etapa]. Es un archivo JSON liviano (~2 KB), NO doctrina.
// Se incluye en el bundle de Vercel por `includeFiles: data/**` (vercel.json).
// Cache por proceso: se parsea una vez, igual que materiaCorpus.ts.

import fs from "fs";
import path from "path";
import type { EnrutadorProcesal } from "./caso.schema.js";

export interface Playbook {
  id: string;
  materia: string;
  rol: string;
  etapa: string;
  verificadaPorAbogado: boolean;
  estructura: string[];
  tactica: string[];
  noAlegar?: string[];
  normasBase: string[];
  plazoId?: string;
  alertas?: Record<string, any>;
}

const cache = new Map<string, Playbook | null>();

function ruta(id: string): string {
  return path.join(process.cwd(), "data", "playbooks", `${id}.json`);
}

function leer(id: string): Playbook | null {
  if (cache.has(id)) return cache.get(id)!;
  const archivo = ruta(id);
  if (!fs.existsSync(archivo)) {
    cache.set(id, null);
    return null;
  }
  try {
    const pb = JSON.parse(fs.readFileSync(archivo, "utf-8")) as Playbook;
    cache.set(id, pb);
    return pb;
  } catch {
    cache.set(id, null);
    return null;
  }
}

/**
 * Normaliza ejes del enrutador al vocabulario de los playbooks.
 * Los roles del enrutador son más ricos (querellante/imputado/requirente) que
 * los del playbook (demandante/demandado/tercero); se mapean.
 */
function normalizarRol(rol: string): string {
  if (["querellante", "requirente", "demandante"].includes(rol)) return "demandante";
  if (["imputado", "requerido", "demandado"].includes(rol)) return "demandado";
  return rol || "tercero";
}

function normalizarEtapa(etapa: string): string {
  if (["impugnacion", "ejecucion"].includes(etapa)) return "defensa";
  return etapa || "inicio";
}

/**
 * Busca el playbook para un enrutador dado. Orden de fallback:
 *   1. <materia>-<rol>-<etapa>
 *   2. <materia>-<rol>-defensa / -inicio
 *   3. <materia>-defensa / -inicio
 * Devuelve null si no hay ninguno (el flujo sigue sin playbook).
 */
export function cargarPlaybook(enrutador: Pick<EnrutadorProcesal, "materia" | "rol" | "etapa">): Playbook | null {
  const materia = enrutador.materia || "indeterminada";
  if (materia === "indeterminada") return null;
  const rol = normalizarRol(enrutador.rol);
  const etapa = normalizarEtapa(enrutador.etapa);
  const rolOriginal = enrutador.rol || rol;
  const etapaOriginal = enrutador.etapa || etapa;
  const candidatos = [
    // Primero el cruce exacto con los valores ricos del enrutador (ej.
    // penal-imputado-defensa, constitucional-requirente-inicio).
    `${materia}-${rolOriginal}-${etapaOriginal}`,
    `${materia}-${rol}-${etapa}`,
    `${materia}-${rolOriginal}-defensa`,
    `${materia}-${rol}-defensa`,
    `${materia}-${rol}-inicio`,
    `${materia}-defensa`,
    `${materia}-inicio`,
  ];
  for (const id of candidatos) {
    const pb = leer(id);
    if (pb) return pb;
  }
  return null;
}

/** Bloque de prompt listo para inyectar. Devuelve "" si no hay playbook. */
export function bloquePromptPlaybook(pb: Playbook | null): string {
  if (!pb) return "";
  let s = `\n\n[PLAYBOOK PROCESAL — ${pb.id}]\n`;
  s += `ESTRUCTURA OBLIGATORIA DEL ESCRITO:\n${pb.estructura.map((x) => `- ${x}`).join("\n")}\n`;
  s += `\nTÁCTICA PROCESAL A DESARROLLAR (con hechos concretos, no en abstracto):\n${pb.tactica.map((x) => `- ${x}`).join("\n")}\n`;
  if (pb.noAlegar?.length) {
    s += `\nQUÉ NO ALEGAR:\n${pb.noAlegar.map((x) => `- ${x}`).join("\n")}\n`;
  }
  s += `\nNORMAS BASE A VERIFICAR EN BCN: ${pb.normasBase.join(", ")}\n`;
  if (pb.alertas) {
    const alertas = Object.entries(pb.alertas).filter(([, v]) => v).map(([k, v]) => `${k}${typeof v === "string" ? `: ${v}` : ""}`);
    if (alertas.length) s += `\nALERTAS CRÍTICAS: ${alertas.join(" | ")}\n`;
  }
  s += `(Hipótesis de trabajo — pendiente de validación por abogado. No presentar como verificadas.)\n`;
  return s;
}
