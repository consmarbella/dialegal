// Orquestación del pipeline LegalHelp (capas ①–⑨).
// ① Regex materia + negación + anclas  (materias.ts)
// ② Jerga/sinónimos                   (jergaChile.ts)
// ③ BM25 corpus desempate             (materiaCorpus.ts)
// ④ Citas + BCN XML                   (bcnLeyChile.ts)
// ⑤⑥ Slots + subsunción               (subsumpcion.ts)
// ⑦ Juris filtrada por área           (jurisprudenciaChile.ts)
// ⑧ LLM                               (llmEngine / draft)
// ⑨ Lint + validador                  (lintTactico / validador*)

import { decidirMateria, decidirMateriaHibrida } from "./materiaDecision.js";
import { expandirJergaChile } from "./jergaChile.js";
import {
  extraerHechosTipificados,
  aplicarSubsuncion,
  bloquePromptSubsuncion,
  type HechosTipificados,
  type HipotesisSubsuncion,
} from "./subsumpcion.js";
import type { ResolucionMateria } from "../../materias.js";

export interface ResultadoPipelinePrevio {
  textoParaClasificar: string;
  resolucionMateria: ResolucionMateria;
  hechos: HechosTipificados;
  hipotesis: HipotesisSubsuncion[];
  bloqueSubsuncion: string;
}

/**
 * Capas ①②③⑤⑥ antes del LLM: jerga → materia (regex+corpus) → slots → hipótesis.
 * BCN (④) y juris (⑦) se resuelven async en los handlers existentes.
 *
 * Fase I: si se pasan clientes Gemini, la materia se decide HÍBRIDA — el
 * determinista primero y, solo si se abstiene o empata, un respaldo LLM con
 * salida JSON estructurada. Sin clientes (o si el respaldo falla) queda la
 * decisión determinista pura.
 */
export async function ejecutarPipelinePrevio(
  textoCrudo: string,
  areaDeclarada?: string | null,
  clients?: any | any[] | null,
): Promise<ResultadoPipelinePrevio> {
  const textoParaClasificar = expandirJergaChile(textoCrudo || "");
  const resolucionMateria = clients
    ? await decidirMateriaHibrida(areaDeclarada, textoCrudo, clients)
    : decidirMateria(areaDeclarada, textoParaClasificar);
  const hechos = extraerHechosTipificados(textoParaClasificar);
  const hipotesis = aplicarSubsuncion(hechos);
  const bloqueSubsuncion = bloquePromptSubsuncion(hipotesis, hechos);
  return { textoParaClasificar, resolucionMateria, hechos, hipotesis, bloqueSubsuncion };
}
