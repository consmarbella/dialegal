// materiaCorpus.ts — Fase D.3: soporte de materia por BM25 del corpus.
//
// Por qué existe: el clasificador de materias.ts es determinista (átomos +
// ventana + negación), pero ciego a sinónimos y paráfrasis que no estén en sus
// reglas. El corpus por materia (data/corpus-full/<slug>.json) aporta esa
// semántica léxica sin red ni LLM.
//
// Regla dura del dueño: los scores BM25 CRUDOS NO son comparables entre
// materias (distinto N, largo de documento y vocabulario). Por eso este módulo
// no expone BM25 crudo: devuelve una COBERTURA normalizada en [0,1]
//
//     cobertura = score_BM25(top1) / suma_idf(consulta) * (k1+1)
//
// que mide qué proporción del peso IDF de la consulta cubre el mejor documento
// de ESA materia. Se calcula con el IDF de la propia materia, así que no
// depende del tamaño del corpus. Aun así es una señal léxica, no una
// probabilidad: materias.ts la usa solo para desempatar/abstenerse, nunca para
// inflar la confianza de una decisión ya tomada por las señales.
//
// Costo: los corpus son pequeños (0,2–2,1 MB; 400–900 fichas). El índice se
// construye una vez por proceso y se cachea. Si CORPUS_COMPLETO != "true", el
// módulo se abstiene (devuelve null): el pipeline sigue con regex/ventana.

import fs from "fs";
import path from "path";
import { tokenizar } from "../../jurisprudenciaChile.js";
import type { SlugMateria, SoporteCorpusMateria } from "../../materias.js";
import { corpusForzadoActivo } from "./corpusContext.js";

const K1 = 1.2;
const B = 0.75;
/** Tope de contenido por ficha: el corpus ya trae definiciones largas y el
 *  contenido completo no aporta más señal que su inicio (costo/latencia). */
const MAX_CONTENIDO = 6000;

interface Doc {
  tf: Map<string, number>;
  dl: number;
  institucion: string;
}

interface IndiceMateria {
  slug: SlugMateria;
  docs: Doc[];
  df: Map<string, number>;
  postings: Map<string, number[]>;
  avgdl: number;
  N: number;
}

const cache = new Map<SlugMateria, IndiceMateria | null>();

function corpusActivo(): boolean {
  // Caso pagado: runWithCorpusForzadoAsync fuerza true aunque el env esté apagado.
  if (corpusForzadoActivo()) return true;
  return String(process.env.CORPUS_COMPLETO || "").trim().toLowerCase() === "true";
}

function construirIndice(slug: SlugMateria): IndiceMateria | null {
  if (!corpusActivo()) return null;
  const p = path.join(process.cwd(), "data", "corpus-full", `${slug}.json`);
  if (!fs.existsSync(p)) {
    // tránsito no tiene corpus propio todavía (Fase H): se abstiene, no inventa.
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as { fichas?: any[] };
    const fichas = Array.isArray(raw?.fichas) ? raw.fichas : [];
    if (!fichas.length) return null;
    const docs: Doc[] = [];
    const df = new Map<string, number>();
    const postings = new Map<string, number[]>();
    let totalDl = 0;
    for (const f of fichas) {
      const texto = [
        f?.institucion || "",
        f?.materia || "",
        f?.definicion || "",
        String(f?.contenido || "").slice(0, MAX_CONTENIDO),
      ].filter(Boolean).join(" ");
      const toks = tokenizar(texto);
      const tf = new Map<string, number>();
      // Saturación de TF: una ficha larga no debe ganar por repetir "empresa".
      for (const t of toks) tf.set(t, Math.min((tf.get(t) || 0) + 1, 6));
      const dl = toks.length || 1;
      totalDl += dl;
      const idx = docs.length;
      for (const t of tf.keys()) {
        df.set(t, (df.get(t) || 0) + 1);
        const arr = postings.get(t);
        if (arr) arr.push(idx);
        else postings.set(t, [idx]);
      }
      docs.push({ tf, dl, institucion: String(f?.institucion || "") });
    }
    return { slug, docs, df, postings, avgdl: totalDl / docs.length, N: docs.length };
  } catch (e: any) {
    console.warn(`[materiaCorpus] corpus-full/${slug}.json ilegible: ${String(e?.message || e).slice(0, 120)}`);
    return null;
  }
}

function getIndice(slug: SlugMateria): IndiceMateria | null {
  // Si el índice quedó null porque el flag estaba apagado y ahora el request
  // fuerza corpus (caso pagado), reconstruir.
  if (cache.has(slug)) {
    const cached = cache.get(slug) ?? null;
    if (cached !== null || !corpusActivo()) return cached;
  }
  const idx = construirIndice(slug);
  cache.set(slug, idx);
  return idx;
}

/** Cobertura BM25 normalizada de la materia para el texto dado.
 *  null = la materia no tiene corpus disponible (p. ej. tránsito). */
export function coberturaMateria(texto: string, slug: SlugMateria): SoporteCorpusMateria | null {
  const idx = getIndice(slug);
  if (!idx) return null;
  const q = [...new Set(tokenizar(texto))].filter((t) => idx.df.has(t));
  if (!q.length) return { slug, cobertura: 0, evidencia: null, documentos: idx.N };

  const idf = (t: string) => {
    const df = idx.df.get(t) || 0;
    return Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
  };
  const pesos = new Map<string, number>();
  const candidatos = new Set<number>();
  let maxPosible = 0;
  for (const t of q) {
    const w = idf(t);
    pesos.set(t, w);
    maxPosible += w * (K1 + 1);
    for (const d of idx.postings.get(t) || []) candidatos.add(d);
  }
  if (maxPosible <= 0 || !candidatos.size) {
    return { slug, cobertura: 0, evidencia: null, documentos: idx.N };
  }

  let mejor = -1;
  let mejorDoc = -1;
  for (const d of candidatos) {
    const doc = idx.docs[d];
    let s = 0;
    for (const [t, w] of pesos) {
      const tf = doc.tf.get(t);
      if (!tf) continue;
      s += (w * (tf * (K1 + 1))) / (tf + K1 * (1 - B + (B * doc.dl) / idx.avgdl));
    }
    if (s > mejor) { mejor = s; mejorDoc = d; }
  }
  const cobertura = Math.max(0, Math.min(1, mejor / maxPosible));
  return {
    slug,
    cobertura: Number(cobertura.toFixed(4)),
    evidencia: mejorDoc >= 0 ? idx.docs[mejorDoc].institucion : null,
    documentos: idx.N,
  };
}

/** Soporte de las materias candidatas, ordenado por cobertura descendente.
 *  Solo se puntúan los candidatos que el regex/ventana ya propuso (top 2-3) o,
 *  si se abstuvo, todas las materias con corpus. */
export function soporteCorpusMaterias(texto: string, candidatos: SlugMateria[]): SoporteCorpusMateria[] {
  const out: SoporteCorpusMateria[] = [];
  for (const slug of [...new Set(candidatos)]) {
    const s = coberturaMateria(texto, slug);
    if (s) out.push(s);
  }
  return out.sort((a, b) => b.cobertura - a.cobertura);
}
