// Detector de área legal para LegalHelp IA — Fase D.
// La clasificación vive en materias.ts (registro único de materias); este
// módulo conserva la API histórica (detectarArea / detectAreaFromContext /
// getAreaConfidence) para no romper a sus 5 consumidores.
//
// CAMBIO DE SEMÁNTICA (causa raíz de la contaminación del informe real,
// Fase A hallazgos.md): SIN señales o en empate se devuelve null (materia
// indeterminada). Antes se devolvía "laboral" por defecto
// (area-detector.ts:112 y :136), lo que metía corpus y priming laboral en
// casos civiles. El área declarada por el usuario SIEMPRE manda (resolverMateria).

import { clasificarMateria, type SlugMateria, type ClasificacionMateria } from "./materias.js";

export type DraftArea = SlugMateria;
export type { ClasificacionMateria };

function mejor(texto: string): ClasificacionMateria {
  return clasificarMateria(texto);
}

export function detectarArea(hechos: string, pretensiones: string[], extractorAcciones?: string[]): DraftArea | null {
  // extractorAcciones: las acciones del extractor chileno ya viven en el texto
  // que el llamador junta; se suman como contexto (comportamiento previo).
  const extra = (extractorAcciones || []).join(" ");
  const texto = [hechos || "", (pretensiones || []).join(" "), extra].filter(Boolean).join("\n");
  return mejor(texto).slug;
}

/** Confianza = margen determinista entre los dos mejores conteos de señales
 *  (0 para la única; sin señales -> area null, confidence 0). */
export function getAreaConfidence(hechos: string, pretensiones: string[]): { area: DraftArea | null; confidence: number } {
  const c = mejor([hechos || "", (pretensiones || []).join(" ")].filter(Boolean).join("\n"));
  return { area: c.slug, confidence: c.margen };
}

/** Clasificador sobre texto crudo (contexto de server.ts). Antes devolvía
 *  "laboral" si nada calzaba; ahora null = indeterminada. */
export function detectAreaFromContext(context: string): DraftArea | null {
  return mejor(context || "").slug;
}
