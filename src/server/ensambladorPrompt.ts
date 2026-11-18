// ensambladorPrompt.ts — Ensamblador dinámico de prompt (bloques desacoplados).
//
// Con el enrutador de 4 ejes y el playbook procesal, el prompt se arma con
// bloques independientes en este orden:
//   Bloque 1: Playbook Procesal (estructura + táctica del cruce [Materia+Rol+Etapa])
//   Bloque 2: Normativa BCN verificada (la resuelve legalhelp-draft.ts)
//   Bloque 3: Doctrina/Jurisprudencia (la resuelve legalhelp-draft.ts, filtrada por materia)
//   Bloque 4: Hechos del usuario (los arma legalhelp-draft.ts)
//
// Este módulo solo produce el Bloque 1 y expone las normas base para que el
// handler verifique BCN. Mantiene el patrón "menos es más": sin frameworks.

import type { EnrutadorProcesal } from "./caso.schema.js";
import { cargarPlaybook, bloquePromptPlaybook, type Playbook } from "./playbookLoader.js";

export interface ResultadoEnsamblaje {
  bloquePlaybook: string;
  playbook: Playbook | null;
  normasBase: string[];
  plazoId?: string;
  alertas: Record<string, any>;
}

/**
 * Ensambla a partir del enrutador. Si no hay enrutador o no hay playbook para
 * el cruce, devuelve un resultado vacío (el flujo legacy sigue igual).
 */
export function ensamblarDesdeEnrutador(
  enrutador: EnrutadorProcesal | null | undefined,
): ResultadoEnsamblaje {
  if (!enrutador) {
    return { bloquePlaybook: "", playbook: null, normasBase: [], alertas: {} };
  }
  const playbook = cargarPlaybook(enrutador);
  if (!playbook) {
    return { bloquePlaybook: "", playbook: null, normasBase: [], alertas: enrutador.alertas || {} };
  }
  return {
    bloquePlaybook: bloquePromptPlaybook(playbook),
    playbook,
    normasBase: playbook.normasBase,
    plazoId: playbook.plazoId,
    alertas: { ...(enrutador.alertas || {}), ...(playbook.alertas || {}) },
  };
}
