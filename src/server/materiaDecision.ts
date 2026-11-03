// materiaDecision.ts — orquestador de la decisión de materia (Fase D.2/D.3).
//
// Une las dos capas deterministas:
//   1. clasificarMateria (materias.ts): átomos + ventana + negación + anclas.
//   2. soporteCorpusMaterias (materiaCorpus.ts): BM25 normalizado por materia
//      sobre data/corpus-full/<slug>.json, solo para los candidatos.
// y las fusiona en resolverMateria. El corpus SOLO actúa cuando las señales
// se abstienen o empatan: nunca infla la confianza de una decisión ya tomada.
//
// Server-only: los corpus se leen con fs (2-6 MB por área, cacheados por
// proceso). Los flujos que clasifican materia (/api/analyze, premium,
// legalhelp-draft) deben llamar a decidirMateria, no a resolverMateria a pelo.

import { clasificarMateria, resolverMateria, type SlugMateria, type ResolucionMateria } from "../../materias.js";
import { soporteCorpusMaterias } from "./materiaCorpus.js";

const TODAS: SlugMateria[] = [
  "civil", "laboral", "familia", "penal", "administrativo", "constitucional", "transito",
];

export function decidirMateria(
  areaDeclarada: string | null | undefined,
  texto: string,
): ResolucionMateria {
  const clas = clasificarMateria(texto);
  // Top 2-3 candidatos del regex; si se abstuvo (sin señales), todas las
  // materias con corpus (el corpus es la última opción antes de indeterminada).
  const candidatos = clas.scores.length
    ? clas.scores.slice(0, 3).map((x) => x.slug)
    : TODAS;
  const soporte = candidatos.length ? soporteCorpusMaterias(texto, candidatos) : [];
  return resolverMateria(areaDeclarada, texto, soporte);
}
