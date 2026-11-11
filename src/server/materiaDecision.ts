// materiaDecision.ts — orquestador de la decisión de materia (Fase D.2/D.3 + Fase I).
//
// Une las dos capas deterministas:
//   1. clasificarMateria (materias.ts): átomos + ventana + negación + anclas
//      + términos ambiguos desambiguados por ORACIÓN (Fase I).
//   2. soporteCorpusMaterias (materiaCorpus.ts): BM25 normalizado por materia
//      sobre data/corpus-full/<slug>.json, solo para los candidatos.
// y las fusiona en resolverMateria. El corpus SOLO actúa cuando las señales
// se abstienen o empatan: nunca infla la confianza de una decisión ya tomada.
//
// Fase I añade decidirMateriaHibrida: si el determinista se abstiene o empata,
// una llamada LLM con salida JSON estructurada clasifica el relato (capa de
// respaldo, nunca primera opción). Los flujos server-side (/api/analyze,
// premium, draft) usan la híbrida cuando tienen clientes Gemini.
//
// Server-only: los corpus se leen con fs (2-6 MB por área, cacheados por
// proceso). Los flujos que clasifican materia deben llamar a decidirMateria
// (sync, sin red) o decidirMateriaHibrida (async, con respaldo LLM), nunca
// resolverMateria a pelo.

import { clasificarMateria, resolverMateria, MATERIAS, normalizarAreaDeclarada, type SlugMateria, type ResolucionMateria } from "../../materias.js";
import { soporteCorpusMaterias } from "./materiaCorpus.js";
import { expandirJergaChile } from "./jergaChile.js";
import { decidirMateriaLLM } from "./materiaLLM.js";

const TODAS: SlugMateria[] = [
  "civil", "laboral", "familia", "penal", "administrativo", "constitucional", "transito",
];

export function decidirMateria(
  areaDeclarada: string | null | undefined,
  texto: string,
): ResolucionMateria {
  const textoClas = expandirJergaChile(texto || "");
  const clas = clasificarMateria(textoClas);
  // Top 2-3 candidatos del regex; si se abstuvo (sin señales), todas las
  // materias con corpus (el corpus es la última opción antes de indeterminada).
  const candidatos = clas.scores.length
    ? clas.scores.slice(0, 3).map((x) => x.slug)
    : TODAS;
  const soporte = candidatos.length ? soporteCorpusMaterias(textoClas, candidatos) : [];
  return resolverMateria(areaDeclarada, textoClas, soporte);
}

/** Confianza mínima del respaldo LLM para aceptar su clasificación. */
const CONFIANZA_LLM_MIN = 0.6;

/**
 * Fase I: decisión híbrida. El determinista decide; SOLO cuando se abstiene
 * (indeterminada) o su advertencia es de duda (materia_ambigua / materia_
 * sugerida) se consulta al LLM de respaldo con salida JSON estructurada.
 * Si el respaldo falla o no alcanza la confianza mínima, se mantiene la
 * decisión determinista original (degradación honesta, nunca bloqueo).
 */
export async function decidirMateriaHibrida(
  areaDeclarada: string | null | undefined,
  texto: string,
  clients?: any | any[] | null,
): Promise<ResolucionMateria> {
  const base = decidirMateria(areaDeclarada, texto);
  // Duda = el determinista no concluyó por sí solo: se abstuvo, su advertencia
  // es de debilidad/ambigüedad, o desempató por corpus (una sugerencia léxica
  // BM25 que por diseño "requiere confirmación" — un caso sin señales puede
  // quedar mal sugerido por léxico: A006, empresa de eventos en quiebra, se
  // sugería administrativo y es civil).
  const duda = base.origen === "indeterminada"
    || base.origen === "corpus"
    || (!!base.advertencia && /materia_ambigua|materia_sugerida/.test(base.advertencia));
  if (!duda || !clients || !(texto || "").trim()) return base;

  const llm = await decidirMateriaLLM(clients, texto);
  if (!llm || !llm.slug || llm.confianza < CONFIANZA_LLM_MIN) {
    return {
      ...base,
      advertencia: `${base.advertencia ? `${base.advertencia} ` : ""}[respaldo LLM consultado y no concluyó (confianza ${llm?.confianza ?? 0}): se mantiene la decisión determinista.]`,
    };
  }
  const declarada = normalizarAreaDeclarada(areaDeclarada);
  const secundaria = llm.secundaria && llm.secundaria !== llm.slug
    ? llm.secundaria
    : base.materiaSecundaria;
  return {
    ...base,
    slug: llm.slug,
    origen: "llm",
    materiaSecundaria: secundaria,
    conflicto: declarada && declarada !== llm.slug
      ? `materia_decidida_por_llm: el usuario declaró "${MATERIAS[declarada].nombre}" y el modelo de respaldo clasificó "${MATERIAS[llm.slug].nombre}". La plataforma sigue al respaldo; confirma la materia si el relato está incompleto.`
      : base.conflicto,
    advertencia: `materia_decidida_por_llm (confianza ${llm.confianza}): ${llm.razones}. Respaldo consultado porque las señales deterministas se abstuvieron o empataron.`,
  };
}
