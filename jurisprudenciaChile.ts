// Recuperacion jurisprudencial determinista (vertical laboral) sobre el corpus
// Open Legal Chile (Hugging Face), ingestado a data/jurisprudencia-laboral.json.
// Cada ficha = institucion dogmatica + fallo rector de la Corte Suprema +
// concordancias BCN. Busqueda: scoring de tokens multi-region con bonus de
// frases. Determinista, sin red, sin dependencias. Fallo = sin resultados (nunca arroja).
import fs from "fs";
import path from "path";
import { corpusForzadoActivo } from "./src/server/corpusContext.js";
// Fase I.3: NORMA_IDS resuelve los cuerpos de las normas de cada ficha contra
// las citas del caso (boost por solapamiento) y extraerCitadasPorNorma saca
// esas citas del propio texto del caso. Sin dependencia circular: bcnLeyChile
// no importa nada de este módulo.
import { NORMA_IDS, extraerCitadasPorNorma } from "./bcnLeyChile.js";

export interface FalloRector { rol: string; fecha: string; extra: string; raw: string }
export interface FichaJuris {
  id: string;
  institucion: string;
  area: string;
  materia: string;
  obra: string;
  autor: string;
  definicion: string;
  operativaProcesal: string;
  fallos: string[];
  falloRector: FalloRector | null;
  normas: string[];
  tokens: number;
  contenido: string;
}
export interface Corpus {
  fuente: string;
  total: number;
  fichas: FichaJuris[];
}

// Fase D: el slug del área pedida se marca como "fuera de corpus" cuando el
// resultado salió de la base (fallback), para etiquetarlo en el prompt y la UI.
export interface RecomendacionJuris {
  institucion: string;
  materia: string;
  autor: string;
  obra: string;
  falloRector: FalloRector | null;
  normas: string[];
  dictamenes: string[];
  definicion: string;
  contenido: string;
  operativaProcesal: string;
  relleno: boolean;
  puntuacion: number;
  // Fase D: true cuando la ficha salió de la base (laboral) a pesar de que el
  // caso pedía otra área — fallback anti-hambre, SIEMPRE etiquetado.
  fuenteFallback?: boolean;
  // Fase D: true cuando la ficha viene de la capa transversal (procesal/
  // general), no del corpus propio del área.
  fuenteTransversal?: boolean;
}

const STOP = new Set([
  "sobre", "conforme", "cuando", "para", "con", "por", "del", "los", "las", "una", "como", "pero", "que", "sus", "mas", "esto", "esta", "caso", "donde", "cual", "todo", "toda",
]);

function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Tokenizador compartido con el clasificador de materias (Fase D.3):
 *  minúsculas, sin tildes, sin stopwords, tokens de 3+ caracteres. */
export function tokenizar(s: string): string[] {
  const base = quitarAcentos(s.toLowerCase());
  const out: string[] = [];
  const re = /[a-z0-9]{3,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(base)) !== null) {
    const t = m[0];
    if (STOP.has(t)) continue;
    if (/^\d{1,3}[.,:]?$/.test(t)) continue;
    out.push(t);
  }
  return out;
}

// Pesos por region: donde aparece un token indica su relevancia juridica.
const P_W = 6;   // institucion
const M_W = 4;   // materia
const D_W = 3;   // definicion
const C_W = 1;   // contenido (grande, peso bajo)
// Fase 6: sesgo de vigencia. Las fichas con fallo rector reciente ganan empates
// sutiles (max +0.15) sobre las antiguas: "argumentar con el criterio de HOY".
// Fase 7 (A/B): peso env-overridable (RECENCY_W) y override por llamada
// (opts.recencyW) para el QA.
function recencyW(): number {
  const v = Number(process.env.RECENCY_W);
  return Number.isFinite(v) && v >= 0 ? v : 0.15;
}
const N_W = 2;   // normas/concordancias

interface RegionPredistribuida { [token: string]: number }

interface FichaIndexada {
  ficha: FichaJuris;
  regiones: Array<{ p: number; mapa: RegionPredistribuida }>;
  blobFrase: string; // para bonus de frases (lowcase sin acentos)
  relleno: string | null; // motivo si la ficha es relleno administrativo (Fase 8)
  // Fase D: de qué archivo salió (área pedida o capa transversal) para
  // etiquetar el origen en el prompt y la UI. La base no trae etiqueta.
  slugOrigen?: SlugCorpusArea;
}

// ── Fase 8: deteccion de fichas-relleno administrativo ─────────────────────
// Auditoria: evaluation/jurisprudencia/audit-corpus-calidad.json (1.906/5.711
// candidatos, 33.4%; revision manual de 34: ~26-28 basura clara, ~80% precision,
// las "borderline" igual tienen titulo truncado). Decision MEDIDA (leccion Fase 3):
// NO exclusion dura del corpus -> degradacion en resultados con fallback: el
// relleno solo aparece si no alcanzan fichas sustantivas (maxResultados).
// Nunca aplica a fichas CON falloRector (las 103 citables quedan intactas).
const INFINITIVO_START = /^(chequear|atender|ejercer|entregar|publicar|canalizar|supervisar|verificar|registrar|remitir|administrar|coordinar|llevar|mantener|cumplir|controlar|informar|emitir|confeccionar|otorgar|realizar|efectuar|preparar|archivar|enviar|recibir|custodiar|elaborar|implementar|difundir|garantizar|procurar|velar|fiscalizar|designar|nombrar|convocar|decretar|disponer|resolver|conocer|devenir)\b/i;
const TRUNCADA_END = /(\s(y|o|u|e|de|del|la|el|los|las|un|una|su|sus|para|por|con|en|a|que|se|al|lo)\.?)$/i;
// Fase I.3 (caso real software/competencia desleal): títulos-fragmento de
// sentencia usados como "institución" por la ingesta del corpus ("En cuanto al
// fondo", "Reconocimiento legal y noción", "Corte Suprema, 3 de marzo de
// 2020, Rol Nº ..."). Son oraciones, no instituciones: se degradan como
// relleno para que no ocupen cupos de fichas sustantivas.
const FRAGMENTO_START = /^(en\s+(cuanto|este\s+caso|relaci[oó]n|consecuencia|t[eé]rminos|virtud|caso\s+de\s+tratarse)|caso\s+de\s+tratarse|reconocimiento\s+legal\s+y\s+noci[oó]n|corte\s+suprema,?\s+\d|la\s+secuencia\s+es)/i;
// Fase I.4 (informe real pagaré): viñetas de ingesta como título ("B) pago
// por consignación") y fragmentos que terminan en flecha de esquema
// ("obligación de dar →obligación de conservar →").
const BULLET_START = /^[a-z]\)\s/i;
const ARROW_END = /→\s*$/;

export function esFichaRelleno(ficha: { institucion?: string; falloRector?: { rol?: string } | null }): string | null {
  const inst = String(ficha.institucion || "").trim();
  if (INFINITIVO_START.test(inst)) return "infinitivo_inicio";
  if (FRAGMENTO_START.test(inst)) return "fragmento_sentencia";
  if (BULLET_START.test(inst)) return "vineta_ingesta";
  if (ARROW_END.test(inst)) return "fragmento_esquema";
  if (ficha.falloRector && ficha.falloRector.rol) return null; // citable: nunca relleno
  if (TRUNCADA_END.test(inst) && inst.length > 20) return "truncada";
  if (inst.length > 110) return "titulo_largo";
  return null;
}

let corpusCache: Corpus | null = null;
let corpusError = "";

function rutaCorpus(): string | null {
  const nombre = path.join("data", "jurisprudencia-laboral.json");
  const candidatos = [path.resolve(process.cwd(), nombre)];
  // __dirname solo existe en el bundle CJS de prod (dist/server.cjs): typeof no arroja en ESM
  if (typeof __dirname !== "undefined") {
    candidatos.push(
      path.resolve(__dirname, nombre),
      path.resolve(__dirname, "..", "..", nombre),
      path.resolve(__dirname, "..", nombre)
    );
  }
  for (const c of candidatos) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function getCorpus(): Corpus | null {
  if (corpusCache) return corpusCache;
  if (corpusError) return null;
  const p = rutaCorpus();
  if (!p) { corpusError = "data/jurisprudencia-laboral.json no encontrado"; console.warn(`[juris] ${corpusError}`); return null; }
  try {
    const raw = fs.readFileSync(p, "utf-8");
    corpusCache = JSON.parse(raw) as Corpus;
    if (!corpusCache || !Array.isArray(corpusCache.fichas) || corpusCache.fichas.length === 0) {
      corpusError = "corpus vacio";
      corpusCache = null;
    }
  } catch (e: any) {
    corpusError = String(e?.message || e);
    console.warn(`[juris] corpus ilegible: ${corpusError}`);
    corpusCache = null;
  }
  return corpusCache;
}

function construirIndice(corpus: Corpus, slugOrigen?: SlugCorpusArea): FichaIndexada[] {
  if (!corpus) return [];
  const out: FichaIndexada[] = [];
  for (const ficha of corpus.fichas) {
    const regiones: Array<{ p: number; mapa: RegionPredistribuida }> = [];
    const agregar = (texto: string, peso: number) => {
      if (!texto) return;
      const mapa: RegionPredistribuida = {};
      // Fase 8b: saturacion de TF (estandar IR/BM25). Antes mapa[t] += peso por
      // CADA repeticion: una ficha base de 46k chars repetia "empresa" 39 veces
      // y sumaba ~80 puntos con UN token comun, tapando fichas enfocadas
      // (medido en scripts/_probe_desglose.ts). Cap = 3x el peso de region.
      const cap = peso * 3;
      for (const t of tokenizar(texto)) {
        mapa[t] = Math.min((mapa[t] || 0) + peso, cap);
        // Clave de prefijo para tolerar variantes morfologicas (despido/despedido,
        // necesidades/caso de necesidad) en espanol juridico sin un stemmer completo.
        if (t.length >= 6) {
          const pref = t.slice(0, 5);
          mapa[pref] = Math.min((mapa[pref] || 0) + peso * 0.5, cap);
        }
      }
      regiones.push({ p: peso, mapa });
    };
    agregar(ficha.institucion, P_W);
    const materiaObra = `${ficha.materia || ""} ${ficha.obra || ""}`;
    agregar(materiaObra, M_W);
    agregar(ficha.definicion, D_W);
    agregar((ficha.normas || []).join(" "), N_W);
    agregar(ficha.contenido, C_W);
    const blobFrase = quitarAcentos(
      `${ficha.institucion || ""} ${ficha.materia || ""} ${ficha.definicion || ""} ${ficha.contenido || ""}`.toLowerCase()
    );
    out.push({ ficha, regiones, blobFrase, relleno: esFichaRelleno(ficha), ...(slugOrigen ? { slugOrigen } : {}) });
  }
  return out;
}

let indice: FichaIndexada[] | null = null;
function getIndice(): FichaIndexada[] {
  if (indice === null) {
    const corpus = getCorpus();
    indice = corpus ? construirIndice(corpus) : [];
  }
  return indice;
}

// ====== Fase 5: corpus completo por area (gate CORPUS_COMPLETO=true) ======
// data/corpus-full/<slug>.json lo generan scripts/corpus_ingest_full.py desde el
// dataset HF (11.858 fichas -> 2.130 institucionos unicas tras los mismos
// filtros de calidad y dedup de la base laboral). Solo se cargan el archivo del
// area pedida + transversal (Judicial/Procesal/General), y SOLO si el flag
// CORPUS_COMPLETO=true esta definido. Con el flag apagado el motor usa la base
// actual y el slug extra es inerte (misma respuesta que antes, costo 0).
// Fase D: se agrega "transito" (decision del dueno: 7 corpus + transito). No
// existe data/corpus-full/transito.json todavia (el dataset fuente no trae
// area Transito): la busqueda de transito corre sobre la capa transversal y
// el corpus propio se ingesta solo con fuente real (Fase H). La base laboral
// DEJA de concatenarse permanentemente: es FALLBACK cuando el area pedida no
// tiene corpus (con etiqueta fuenteFallback, nunca silenciosa).
export type SlugCorpusArea = "laboral" | "civil" | "familia" | "penal" | "administrativo" | "constitucional" | "transito" | "transversal";
const SLUGS_CORPUS_AREA = new Set<SlugCorpusArea>(["laboral", "civil", "familia", "penal", "administrativo", "constitucional", "transito", "transversal"]);

export function esSlugCorpusArea(a: string): boolean {
  return SLUGS_CORPUS_AREA.has(a.trim().toLowerCase() as SlugCorpusArea);
}

function corpusCompletoActivo(): boolean {
  // Casos pagados: runWithCorpusForzadoAsync fuerza true aunque el env esté apagado.
  if (corpusForzadoActivo()) return true;
  return String(process.env.CORPUS_COMPLETO || "").trim().toLowerCase() === "true";
}

const corpusPorArea = new Map<SlugCorpusArea, Corpus>();
const indicePorArea = new Map<SlugCorpusArea, FichaIndexada[]>();

function getCorpusArea(slug: SlugCorpusArea): Corpus | null {
  if (!corpusCompletoActivo()) return null;
  if (!SLUGS_CORPUS_AREA.has(slug)) return null;
  const cache = corpusPorArea.get(slug);
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "data", "corpus-full", `${slug}.json`);
    const raw = fs.readFileSync(p, "utf-8");
    const corpus = JSON.parse(raw) as Corpus;
    if (!corpus || !Array.isArray(corpus.fichas) || corpus.fichas.length === 0) return null;
    corpusPorArea.set(slug, corpus);
    return corpus;
  } catch (e: any) {
    console.warn(`[juris] corpus-full/${slug}.json ilegible o ausente (sigue con base): ${String(e?.message || e).slice(0, 120)}`);
    return null;
  }
}

function getIndiceArea(slug: SlugCorpusArea): FichaIndexada[] {
  if (!corpusCompletoActivo()) return [];
  const cacheKey = slug as SlugCorpusArea;
  const cached = indicePorArea.get(cacheKey);
  // Reconstruir si el cache quedó vacío con el flag apagado y ahora hay force de pago.
  if (cached && cached.length) return cached;
  if (cached && !corpusCompletoActivo()) return cached;
  const corpus = getCorpusArea(slug);
  if (!corpus) {
    indicePorArea.set(cacheKey, []);
    return [];
  }
  const idx = construirIndice(corpus, slug);
  indicePorArea.set(cacheKey, idx);
  return idx;
}

function getIndiceExtendido(slug: string | undefined): FichaIndexada[] {
  if (!corpusCompletoActivo() || !slug) return [];
  const clean = slug.trim().toLowerCase() as SlugCorpusArea;
  const extras: FichaIndexada[] = [];
  if (clean !== "transversal") {
    const idxArea = getIndiceArea(clean);
    if (idxArea.length) extras.push(...idxArea);
  }
  const trans = getIndiceArea("transversal");
  if (trans.length) extras.push(...trans);
  return extras;
}

// Fase 8b: ventana de proximidad (NLP-lite). El bag-of-words trata igual un
// par de conceptos a 5 palabras de distancia que a 2.000; por eso fichas
// genericas largas ("Suministro de mano de obra") acumulan puntos dispersos y
// le ganan a la ficha donde los conceptos estan juntos. Aqui un PAR de tokens
// de la consulta que co-ocurren dentro de VENTANA palabras en la ficha suma
// bonus proporcional al IDF menor del par (los pares raros -conceptos
// juridicos- pesan; los genericos no). Generaliza el bigrama exacto (+3), que
// exige adyacencia total y muere con stopwords intercaladas ("plazo para
// contestar"). Medido en scripts/_probe_proximidad.ts (antes/despues).
export const VENTANA_PROXIMIDAD = 12; // palabras
const MAX_BONUS_VENTANA = 8;          // cota por ficha
const MAX_OCURRENCIAS = 8;            // por token (costo acotado)

export function bonusVentana(
  queryTokens: string[],
  blob: string,
  idf: (t: string) => number
): number {
  const uniq = [...new Set(queryTokens)].filter((t) => t.length >= 3);
  if (uniq.length < 2 || !blob) return 0;
  const exactos = new Set(uniq);
  const tokenPorPref = new Map<string, string>();
  for (const t of uniq) if (t.length >= 6) tokenPorPref.set(t.slice(0, 5), t);
  const pos = new Map<string, number[]>();
  let i = 0;
  for (const crudo of blob.split(/\s+/)) {
    i++;
    const w = crudo.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (!w || w.length < 3) continue;
    const tok = exactos.has(w) ? w : w.length >= 6 ? tokenPorPref.get(w.slice(0, 5)) : undefined;
    if (!tok) continue;
    const arr = pos.get(tok);
    if (arr) { if (arr.length < MAX_OCURRENCIAS) arr.push(i); } else pos.set(tok, [i]);
  }
  const toks = [...pos.keys()];
  if (toks.length < 2) return 0;
  let bonus = 0;
  for (let a = 0; a < toks.length - 1; a++) {
    for (let b = a + 1; b < toks.length; b++) {
      const pa = pos.get(toks[a]) as number[];
      const pb = pos.get(toks[b]) as number[];
      let cerca = false;
      par: for (const x of pa) {
        for (const y of pb) {
          if (Math.abs(x - y) <= VENTANA_PROXIMIDAD) { cerca = true; break par; }
        }
      }
      if (cerca) bonus += Math.min(idf(toks[a]), idf(toks[b]));
    }
  }
  return Math.min(bonus * 0.5, MAX_BONUS_VENTANA);
}

function bonusFrase(queryTokens: string[], blobFrases: string[]): number {
  let bonus = 0;
  for (let i = 0; i < queryTokens.length - 1; i++) {
    const big = `${queryTokens[i]} ${queryTokens[i + 1]}`;
    for (const b of blobFrases) if (b.includes(big)) bonus += 3;
  }
  return bonus;
}

export async function buscarJurisprudencia(
  textos: string[],
  maxResultados = 6,
  slugArea?: string,
  opts?: { recencyW?: number; citasCaso?: Map<string, Set<string>> },
): Promise<RecomendacionJuris[]> {
  try {
    // Fase D: si el área pedida tiene corpus propio (CORPUS_COMPLETO), ese
    // corpus GOBIERNA la recuperación. La base laboral ya no se concatena
    // siempre (era la causa raiz de la contaminacion civil->laboral del
    // informe real, Fase A hallazgos.md): queda como FALLBACK etiquetado
    // (fuenteFallback) cuando el área no tiene corpus o el flag está apagado.
    const cleanSlug = (slugArea || "").trim().toLowerCase();
    const slugValido = cleanSlug && esSlugCorpusArea(cleanSlug) ? (cleanSlug as SlugCorpusArea) : undefined;
    const ext = getIndiceExtendido(slugValido);
    // Sin slug válido o sin corpus de área: comportamiento previo (base).
    const indiceL = ext.length ? ext : getIndice();
    // Fallback visible: se pidió un área concreta y se sirve la base (laboral).
    const conFallback = !ext.length && !!slugValido && slugValido !== "laboral" && slugValido !== "transversal" && corpusCompletoActivo();
    if (indiceL.length === 0) return [];
    const queryTokens = tokenizar(textos.filter(Boolean).join(" "));
    if (queryTokens.length === 0) return [];

    // Tokens raros del caso valen mas (steel idf simple por longitud de documento del corpus no necesario)
    const bosque: Record<string, number> = {};
    for (const idx of indiceL) {
      const vistos = new Set<string>();
      for (const r of idx.regiones) {
        for (const t of Object.keys(r.mapa)) {
          if (vistos.has(t)) continue;
          vistos.add(t);
          bosque[t] = (bosque[t] || 0) + 1;
        }
      }
    }
    const total = indiceL.length;
    const idf = (t: string) => {
      const df = bosque[t] || 0;
      if (df <= 0) return 1; // token solo por prefijo: idf neutro (evita Infinity)
      return Math.log(1 + total / df);
    };

    const resultados: RecomendacionJuris[] = [];
    for (const { ficha, regiones, blobFrase, relleno, slugOrigen } of indiceL) {
      let score = 0;
      const vistosQ = new Set<string>();
      for (const t of queryTokens) {
        if (vistosQ.has(t)) continue;
        vistosQ.add(t);
        let mejorPeso = 0;
        for (const r of regiones) {
          if (r.mapa[t]) mejorPeso = Math.max(mejorPeso, r.mapa[t]);
        }
        if (mejorPeso === 0 && t.length >= 6) {
          const pref = t.slice(0, 5);
          for (const r of regiones) {
            if (r.mapa[pref]) mejorPeso = Math.max(mejorPeso, r.mapa[pref]);
          }
          if (mejorPeso > 0) mejorPeso *= 0.5;
        }
        if (mejorPeso > 0) score += mejorPeso * idf(t);
      }
      if (score < 1.2) continue;
      score += bonusFrase(queryTokens, [blobFrase]);
      score += bonusVentana(queryTokens, blobFrase, idf); // Fase 8b: ventana de proximidad
      // Fase I.3 — boost por SOLAPAMIENTO DE NORMAS CITADAS: una ficha cuyas
      // normas incluyen los mismos artículos que el caso cita es más relevante
      // que otra que solo comparte palabras genéricas. Caso real: la ficha
      // "Sociedad Conyugal..." empató con fichas de responsabilidad contractual
      // puramente por léxico ("sociedad", "patrimonio") en una demanda de
      // software SpA; sus arts. 1718/1725/1765 no tienen relación con los
      // 1545/1556/1558/2314 citados por el caso.
      if (opts?.citasCaso && opts.citasCaso.size > 0 && (ficha.normas || []).length) {
        const claves = Array.from(opts.citasCaso.entries())
          .map(([k, arts]) => ({ def: (NORMA_IDS as Record<string, { detect: RegExp }>)[k], arts }))
          .filter((x) => !!x.def);
        if (claves.length) {
          let overlap = 0;
          for (const ns of ficha.normas || []) {
            const m = /^BCN\s*-\s*([^,]+?),\s*Art\.?\s*(\d+)/i.exec(String(ns));
            if (!m) continue;
            const num = String(parseInt(m[2], 10));
            for (const c of claves) {
              if (c.def.detect.test(m[1].trim()) && c.arts.has(num)) { overlap++; break; }
            }
          }
          if (overlap > 0) score += 4 * Math.min(3, overlap);
        }
      }
      // Fase 6: recency boost del fallo rector. Fecha del corpus en "DD-MM-YYYY"
      // o año solo ("2023") — Fase 7 A/B: ambos parseados. Limitación real:
      // solo ~98/5.706 fichas traen falloRector; boost real pero de alcance
      // acotado (medido en qa-recency-fases7.ts / DECISIONES.md).
      const w = opts?.recencyW !== undefined ? opts.recencyW : recencyW();
      const frFecha = ficha.falloRector?.fecha;
      if (w > 0 && frFecha) {
        const mYr = /(?:^|[\s-])(20\d{2})(?=\s|$|\.|,)/.exec(String(frFecha));
        if (mYr) {
          const aniosAtras = new Date().getFullYear() - Number(mYr[1]);
          if (aniosAtras >= 0) score += w / (1 + 0.8 * aniosAtras);
        }
      }
      resultados.push({
        institucion: ficha.institucion,
        materia: ficha.materia,
        autor: ficha.autor,
        obra: ficha.obra,
        falloRector: ficha.falloRector,
        normas: ficha.normas || [],
        dictamenes: ficha.fallos || [],
        definicion: ficha.definicion,
        contenido: ficha.contenido || "",
        operativaProcesal: ficha.operativaProcesal || "",
        relleno: !!relleno,
        puntuacion: Math.round(score * 100) / 100,
        ...(conFallback ? { fuenteFallback: true } : {}),
        ...(slugOrigen === "transversal" ? { fuenteTransversal: true } : {}),
      });
    }
    // Fase 8: sustantivas primero; el relleno SOLO rellena cupos restantes
    // (fallback anti-hambre: nunca se excluye del corpus, solo se degrada).
    // Fase 8b: dedup base+full (la misma institucion esta indexada en ambos
    // corpus y salia 2 veces gastando cupos).
    resultados.sort((a, b) => b.puntuacion - a.puntuacion);
    const vistosInst = new Set<string>();
    const unicos: RecomendacionJuris[] = [];
    for (const r of resultados) {
      const k = `${(r.institucion || "").trim().toLowerCase()}|${r.falloRector?.rol || ""}`;
      if (vistosInst.has(k)) continue;
      vistosInst.add(k);
      unicos.push(r);
    }
    const sustantivas = unicos.filter(r => !r.relleno);
    const degradadas = unicos.filter(r => r.relleno);
    return sustantivas.slice(0, maxResultados).concat(
      degradadas.slice(0, Math.max(0, maxResultados - sustantivas.length))
    );
  } catch (e: any) {
    console.warn(`[juris] busqueda fallo (no bloquea): ${String(e?.message || e).slice(0, 150)}`);
    return [];
  }
}

export function bloquePromptJuris(r: RecomendacionJuris[]): string {
  if (r.length === 0) return "";
  let s = `\n\nCRITERIO JURISPRUDENCIAL (fichas dogmáticas de Open Legal Chile, cada una con el FALLO RECTOR de la Corte Suprema): ` +
    `Este material es guía de argumentación institucional. Contrástalo con tus búsquedas web antes de citar: si la web confirma el criterio del fallo rector, cite el rol entre paréntesis; si no, marca "no verificado en línea".\n`;
  for (const i of r.slice(0, 6)) {
    // Fase D: origen de la ficha siempre visible (área propia > transversal > fallback base).
    const origen = i.fuenteFallback
      ? " [FALLBACK: ficha de la base laboral, FUERA del área del caso — úsala solo si es realmente aplicable]"
      : i.fuenteTransversal
        ? " [capa transversal: doctrina procesal general, aplica a varias materias]"
        : "";
    s += `\n### ${i.institucion}${origen}\n`;
    if (i.materia) s += `Materia: ${i.materia}\n`;
    if (i.falloRector && i.falloRector.rol) {
      s += `Fallo rector CS: Rol ${i.falloRector.rol} de ${i.falloRector.fecha || "fecha no disp."}`;
      if (i.falloRector.extra) s += ` (${i.falloRector.extra})`;
      s += `\n`;
    }
    if (i.normas && i.normas.length) s += `Normas/complementariedades: ${i.normas.slice(0, 5).join(" · ")}\n`;
    if (i.definicion) s += `Estándar: ${i.definicion.slice(0, 420)}\n`;
    // Fase 8: la doctrina completa solo scoreaba, no llegaba al modelo. Ahora
    // llega un corte acotado (p50 del corpus = 2.500 chars) + la operativa
    // procesal cuando existe (solo 41 fichas la tienen). Cota máxima del bloque
    // con 6 fichas: ~9.7k chars — menor que el dictamen/documento que ya viajan.
    if (i.operativaProcesal) {
      const limiteOp = i.operativaProcesal.includes("Vía Procesal") ? 900 : 300;
      s += `Operativa procesal: ${i.operativaProcesal.slice(0, limiteOp)}\n`;
    }
    if (i.contenido) s += `Contenido: ${i.contenido.slice(0, 900)}\n`;
  }
  s += `\nCon esto construyes la sección "Criterio Jurisprudencial Dominante y Estrategia": criterio dominante, su fallo rector, cómo lo usa el caso y riesgo si la Contraparte tiene criterio contrario.\n`;
  return s;
}

export function resumenJuris(r: RecomendacionJuris[]) {
  return r.slice(0, 6).map((i) => ({
    institucion: i.institucion,
    materia: i.materia,
    autor: i.autor,
    obra: i.obra,
    rolFalloRector: i.falloRector?.rol || "",
    fechaFalloRector: i.falloRector?.fecha || "",
    normas: (i.normas || []).slice(0, 5),
    relleno: !!i.relleno, // Fase 8: observable en juris-test para verificacion en prod
    // Fase D: trazabilidad de origen visible en prod (juris-test / UI)
    fuenteFallback: !!i.fuenteFallback,
    fuenteTransversal: !!i.fuenteTransversal,
  }));
}

// ── Indice de CASOS análogos (Corte Suprema reciente + TC, doctrina cosechada) ───────────────
// data/jurisprudencia-casos.json generado por scripts/juris_ingest_casos.py desde el
// paquete local de Open Legal (pjud_connector + data/jurisprudencia/*.jsonl).

export interface CasoJuris {
  tipo: string; // "caso" | "fallo_rector"
  tribunal: string;
  sala: string;
  rol: string;
  fecha: string;
  caratula: string;
  materia: string;
  doctrina: string;
  normas: string;
  link: string;
}

export interface RecomendacionCaso extends CasoJuris {
  puntuacion: number;
  // Fase D: true cuando el caso salió del pool completo pese a pedir un área
  // concreta (el corpus de casos no tiene área fiable para filtrar) — SIEMPRE
  // etiquetado en prompt/UI, nunca silencioso.
  fuenteFallback?: boolean;
}

interface CorpusCasos { fuente: string; total: number; casos: CasoJuris[] }

let casosCache: CasoJuris[] | null = null;
let casosError = "";

function rutaCasos(): string | null {
  const nombre = path.join("data", "jurisprudencia-casos.json");
  const candidatos = [path.resolve(process.cwd(), nombre)];
  if (typeof __dirname !== "undefined") {
    candidatos.push(
      path.resolve(__dirname, nombre),
      path.resolve(__dirname, "..", "..", nombre),
      path.resolve(__dirname, "..", nombre)
    );
  }
  for (const c of candidatos) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function getCasos(): CasoJuris[] {
  if (casosCache) return casosCache;
  if (casosError) return [];
  const p = rutaCasos();
  if (!p) { casosError = "data/jurisprudencia-casos.json no encontrado"; console.warn(`[juris-casos] ${casosError}`); return []; }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as CorpusCasos;
    if (raw && Array.isArray(raw.casos) && raw.casos.length > 0) {
      casosCache = raw.casos.filter((c) => c.rol && (c.doctrina || c.caratula));
    } else {
      casosError = "corpus de casos vacio";
    }
  } catch (e: any) {
    casosError = String(e?.message || e);
    console.warn(`[juris-casos] ilegible: ${casosError}`);
  }
  return casosCache || [];
}

// ── Fase D: tag de área de un caso análogo ──────────────────────────────────
// El corpus de casos (data/jurisprudencia-casos.json) NO trae área dogmática:
// el campo `materia` guarda la MATERIA PROCESAL ("(LABORAL) UNIFICACIÓN...",
// "INA-STC"). Lo que sí permite filtrar son los marcadores explícitos:
// "(LABORAL)" -> laboral; "INA-*/STC/Constitucional/CPR" -> constitucional;
// el resto queda null (área desconocida, sin inventar).
export type TagAreaCaso = "laboral" | "constitucional" | null;
export function tagAreaCaso(c: CasoJuris): TagAreaCaso {
  const m = `${c.materia || ""} ${c.tribunal || ""}`.toUpperCase();
  if (m.includes("LABORAL") || m.includes("JUZGADO DEL TRABAJO") || m.includes("JUZGADO DE LETRAS DEL TRABAJO")) return "laboral";
  if (/\bINA[-\s]|STC\b|CONSTITUCIONAL|\bCPR\b|INAPLICABILIDAD|PROTECCION DE GARANTIAS/.test(m)) return "constitucional";
  return null;
}

// Pesos por region para casos: la doctrina (crit textual del fallo) domina.
const DOCTRINA_CW = 5;
const CARATULA_CW = 3;
const MATERIA_CW = 4;
const TRIBUNAL_CW = 2;
const NORMAS_CW = 2;

interface CasoIndexado {
  caso: CasoJuris;
  mapa: RegionPredistribuida;
  blobFrase: string;
}

interface IndiceCasos {
  docs: CasoIndexado[];
  bosque: Record<string, number>;
  total: number;
}

let indiceCasos: IndiceCasos | null = null;

function construirIndiceCasos(): IndiceCasos {
  const casos = getCasos();
  const docs: CasoIndexado[] = [];
  const bosque: Record<string, number> = {};
  for (const caso of casos) {
    const mapa: RegionPredistribuida = {};
    const agregar = (texto: string, peso: number) => {
      if (!texto) return;
      for (const t of tokenizar(texto)) {
        mapa[t] = (mapa[t] || 0) + peso;
        if (t.length >= 6) mapa[t.slice(0, 5)] = (mapa[t.slice(0, 5)] || 0) + peso * 0.5;
      }
    };
    agregar(caso.materia, MATERIA_CW);
    agregar(caso.doctrina, DOCTRINA_CW);
    agregar(caso.caratula, CARATULA_CW);
    agregar(`${caso.tribunal} ${caso.sala}`, TRIBUNAL_CW);
    agregar(caso.normas, NORMAS_CW);
    const vistos = new Set<string>();
    for (const t of Object.keys(mapa)) {
      if (vistos.has(t)) continue;
      vistos.add(t);
      bosque[t] = (bosque[t] || 0) + 1;
    }
    const blobFrase = quitarAcentos(`${caso.materia || ""} ${caso.doctrina || ""} ${caso.caratula || ""}`.toLowerCase());
    docs.push({ caso, mapa, blobFrase });
  }
  return { docs, bosque, total: docs.length };
}

function getIndiceCasos(): IndiceCasos {
  if (indiceCasos === null) indiceCasos = construirIndiceCasos();
  return indiceCasos;
}

// ── Fase 8: entradas semilla NO citables ────────────────────────────────────
// Procedencia: pjud_connector.FALLOS_RECTORES_CHILE (datos demo hardcodeados del
// paquete instalado, NO fallos reales verificables): roles redondos (23.456,
// 45.123, 12.890, 34.567, 89.124, 9876), caratulas genericas ("González con
// Empresa Nacional S.A.") y link generico https://juris.pjud.cl. Los 3.135
// ficha_cs y 303 de TC del mismo archivo tienen roles/caratulas reales y quedan.
// No se borran del data file (procedencia visible); se excluyen de resultados.
export const ROLES_SEMILLA_NO_CITABLES = new Set([
  "Rol N° 23.456-2022",
  "Rol N° 45.123-2021",
  "Rol N° 12.890-2023",
  "Rol N° 34.567-2022",
  "Rol N° 89.124-2021",
  "Rol N° 9876-2020-INA",
]);

export async function buscarCasosJuris(textos: string[], maxResultados = 4, slugArea?: string): Promise<RecomendacionCaso[]> {
  try {
    const idx = getIndiceCasos();
    if (idx.docs.length === 0) return [];
    const queryTokens = tokenizar(textos.filter(Boolean).join(" "));
    if (queryTokens.length === 0) return [];
    const idf = (t: string) => {
      const df = idx.bosque[t] || 0;
      if (df <= 0) return 1;
      return Math.log(1 + idx.total / df);
    };
    const resultados: RecomendacionCaso[] = [];
    const noCitables = new Set<string>();
    for (const { caso, mapa, blobFrase } of idx.docs) {
      if (ROLES_SEMILLA_NO_CITABLES.has(caso.rol)) { noCitables.add(caso.rol); continue; } // Fase 8: semilla demo
      let score = 0;
      const vistosQ = new Set<string>();
      for (const t of queryTokens) {
        if (vistosQ.has(t)) continue;
        vistosQ.add(t);
        let peso = mapa[t] || 0;
        if (peso === 0 && t.length >= 6) {
          peso = (mapa[t.slice(0, 5)] || 0) * 0.5;
        }
        if (peso > 0) score += peso * idf(t);
      }
      if (score < 1.2) continue;
      score += bonusFrase(queryTokens, [blobFrase]);
      resultados.push({ ...caso, puntuacion: Math.round(score * 100) / 100 });
    }
    resultados.sort((a, b) => b.puntuacion - a.puntuacion);
    // Fase D: si se pidió un área concreta, los casos con tag DISTINTO se
    // excluyen (p.ej. "(LABORAL) UNIFICACIÓN" en un caso civil). Los null
    // (área desconocida: la materia procesal no permite afirmarla) se
    // mantienen SIN etiqueta de área; excluirlos vaciaría la recuperación.
    const slug = (slugArea || "").trim().toLowerCase();
    const filtroArea = slug === "laboral" || slug === "constitucional"
      ? (t: TagAreaCaso) => t === null || t === slug
      : (t: TagAreaCaso) => t === null;
    const filtrados = slug ? resultados.filter((c) => filtroArea(tagAreaCaso(c))) : resultados;
    // Fase I.3 — fin del fallback CRUZADO: cuando se pidió un área concreta,
    // los casos de OTRA área (p. ej. TC/constitucional en un caso civil) NO se
    // reponen aunque el filtro deje <2 resultados. Un caso análogo de otra
    // materia es ruido presentado como precedente (caso real: demanda civil de
    // software que mostró 6 sentencias del TC sobre seguridad municipal y
    // cotizaciones previsionales, empatadas por "intereses penales"). Sin
    // casos suficientes del área: se entregan los que hay (aunque sean 0),
    // que es lo honesto. El anti-hambre solo aplica sin área pedida.
    const finales = !slug
      ? (filtrados.length >= 2 ? filtrados : (() => {
          const enFiltrados = new Set(filtrados.map((c) => c.rol));
          const repuestos = resultados
            .filter((c) => !enFiltrados.has(c.rol))
            .map((c) => ({ ...c, fuenteFallback: true }));
          return [...filtrados, ...repuestos];
        })())
      : filtrados;
    return finales
      .slice(0, maxResultados)
      .sort((a, b) => (b.tipo === "fallo_rector" ? 1 : 0) - (a.tipo === "fallo_rector" ? 1 : 0) || b.puntuacion - a.puntuacion);
  } catch (e: any) {
    console.warn(`[juris-casos] busqueda fallo (no bloquea): ${String(e?.message || e).slice(0, 150)}`);
    return [];
  }
}

export function bloquePromptCasos(r: RecomendacionCaso[]): string {
  if (r.length === 0) return "";
  let s = `\n\nCASOS ANÁLOGOS (corte/tribunal, corpus cosechado de Open Legal Chile; uso orientativo): ` +
    `Si algún caso es directamente aplicable, menciónalo en la sección "Criterio Jurisprudencial" (rol + doctrina sintetizada). ` +
    `Verifica con búsqueda web antes de citar el rol; si no lo confirman, marca "no verificado en línea".\n`;
  for (const c of r.slice(0, 4)) {
    // Fase D: fallback del pool completo SIEMPRE visible en el prompt.
    const origen = c.fuenteFallback ? " [FALLBACK: fuera del área pedida — úsalo solo si es realmente aplicable]" : "";
    s += `\n### ${c.tribunal}${c.sala ? ` — ${c.sala}` : ""}${origen}\n`;
    if (c.rol) s += `Rol: ${c.rol}${c.fecha ? ` (${c.fecha})` : ""}\n`;
    if (c.materia) s += `Materia: ${c.materia}\n`;
    if (c.doctrina) s += `Doctrina del fallo: ${c.doctrina.slice(0, 320)}\n`;
    if (c.normas) s += `Normas: ${c.normas}\n`;
  }
  return s;
}

export function resumenCasos(r: RecomendacionCaso[]) {
  return r.slice(0, 4).map((c) => ({
    tipo: c.tipo,
    tribunal: c.tribunal,
    sala: c.sala,
    rol: c.rol,
    fecha: c.fecha,
    materia: c.materia,
    doctrina: (c.doctrina || "").slice(0, 400),
    normas: c.normas || "",
    link: c.link,
    // Fase D: trazabilidad visible en prod (el caso salió del pool completo
    // pese a pedir un área concreta).
    fuenteFallback: !!c.fuenteFallback,
  }));
}

// ── Multi-consulta: pasadas separadas por seccion del caso, fusion por ───────
// score maximo. Para documentos largos (100+ pag): hechos, derecho, petitorio
// e invocados generan cada uno su propia consulta, ninguna parte se pierde por
// truncamiento del texto bruto.

export interface ConsultaEtiquetada { texto: string; etiqueta: string }

async function fusionar(runs: { consulta: string; resultados: Array<RecomendacionJuris & { via?: string }> }[], max: number): Promise<RecomendacionJuris[]> {
  const porInstitucion = new Map<string, RecomendacionJuris & { via?: string }>();
  for (const run of runs) {
    for (const r of run.resultados) {
      const prev = porInstitucion.get(r.institucion);
      if (!prev || r.puntuacion > prev.puntuacion) {
        porInstitucion.set(r.institucion, { ...r, via: run.consulta });
      }
    }
  }
  const valores = Array.from(porInstitucion.values());
  // Fase I.5 (corpus): si hay consulta via_decidida, las fichas con guía procesal
  // real ("Vía Procesal") se ordenan primero dentro de cada grupo.
  const viaDecidida = runs.some((r) => r.consulta === "via_decidida");
  const tieneGuiaReal = (r: RecomendacionJuris) =>
    !!r.operativaProcesal && r.operativaProcesal.includes("Vía Procesal");
  const cmp = (a: RecomendacionJuris, b: RecomendacionJuris) => {
    if (viaDecidida) {
      const gA = tieneGuiaReal(a) ? 1 : 0;
      const gB = tieneGuiaReal(b) ? 1 : 0;
      if (gB !== gA) return gB - gA;
    }
    return b.puntuacion - a.puntuacion;
  };
  // Fase 8: misma politica que el single — sustantivas primero, relleno al final.
  const sust = valores.filter(r => !r.relleno).sort(cmp);
  const degr = valores.filter(r => r.relleno).sort(cmp);
  return sust.concat(degr).slice(0, max);
}

export async function buscarJurisprudenciaMulti(consultas: ConsultaEtiquetada[], maxResultados = 6, slugArea?: string): Promise<RecomendacionJuris[]> {
  const validas = consultas.filter((c) => typeof c.texto === "string" && c.texto.trim().length >= 15);
  if (validas.length === 0) return [];
  // Fase I.3: citas norma+artículo del propio caso (determinista) para el
  // boost por solapamiento — una ficha que cita los mismos artículos del caso
  // gana sobre otra que solo comparte vocabulario genérico.
  const citasCaso = new Map<string, Set<string>>();
  try {
    for (const c of validas) {
      const { pares } = extraerCitadasPorNorma(c.texto);
      for (const p of pares) {
        if (!p.norma) continue;
        let s = citasCaso.get(p.norma.key);
        if (!s) { s = new Set(); citasCaso.set(p.norma.key, s); }
        s.add(p.num);
      }
    }
  } catch { /* sin citas: boost desactivado, ranking léxico clásico */ }
  const runs = await Promise.all(
    validas.map(async (c) => ({ consulta: c.etiqueta || "general", resultados: await buscarJurisprudencia([c.texto], 8, slugArea, { citasCaso }) }))
  );
  return fusionar(runs, maxResultados);
}

async function fusionarCasos(runs: { consulta: string; resultados: RecomendacionCaso[] }[], max: number): Promise<RecomendacionCaso[]> {
  const porRol = new Map<string, RecomendacionCaso>();
  for (const run of runs) {
    for (const r of run.resultados) {
      const prev = porRol.get(r.rol);
      if (!prev || r.puntuacion > prev.puntuacion) {
        porRol.set(r.rol, r);
      }
    }
  }
  return Array.from(porRol.values())
    .sort((a, b) => (b.tipo === "fallo_rector" ? 1 : 0) - (a.tipo === "fallo_rector" ? 1 : 0) || b.puntuacion - a.puntuacion)
    .slice(0, max);
}

export async function buscarCasosJurisMulti(consultas: ConsultaEtiquetada[], maxResultados = 4, slugArea?: string): Promise<RecomendacionCaso[]> {
  const validas = consultas.filter((c) => typeof c.texto === "string" && c.texto.trim().length >= 15);
  if (validas.length === 0) return [];
  const runs = await Promise.all(
    validas.map(async (c) => ({ consulta: c.etiqueta || "general", resultados: await buscarCasosJuris([c.texto], 6, slugArea) }))
  );
  return fusionarCasos(runs, maxResultados);
}
