// Recuperacion jurisprudencial determinista (vertical laboral) sobre el corpus
// Open Legal Chile (Hugging Face), ingestado a data/jurisprudencia-laboral.json.
// Cada ficha = institucion dogmatica + fallo rector de la Corte Suprema +
// concordancias BCN. Busqueda: scoring de tokens multi-region con bonus de
// frases. Determinista, sin red, sin dependencias. Fallo = sin resultados (nunca arroja).
import fs from "fs";
import path from "path";

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

export interface RecomendacionJuris {
  institucion: string;
  materia: string;
  autor: string;
  obra: string;
  falloRector: FalloRector | null;
  normas: string[];
  dictamenes: string[];
  definicion: string;
  puntuacion: number;
}

const STOP = new Set([
  "sobre", "conforme", "cuando", "para", "con", "por", "del", "los", "las", "una", "como", "pero", "que", "sus", "mas", "esto", "esta", "caso", "donde", "cual", "todo", "toda",
]);

function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenizar(s: string): string[] {
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
const N_W = 2;   // normas/concordancias

interface RegionPredistribuida { [token: string]: number }

interface FichaIndexada {
  ficha: FichaJuris;
  regiones: Array<{ p: number; mapa: RegionPredistribuida }>;
  blobFrase: string; // para bonus de frases (lowcase sin acentos)
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

function construirIndice(corpus: Corpus): FichaIndexada[] {
  if (!corpus) return [];
  const out: FichaIndexada[] = [];
  for (const ficha of corpus.fichas) {
    const regiones: Array<{ p: number; mapa: RegionPredistribuida }> = [];
    const agregar = (texto: string, peso: number) => {
      if (!texto) return;
      const mapa: RegionPredistribuida = {};
      for (const t of tokenizar(texto)) {
        mapa[t] = (mapa[t] || 0) + peso;
        // Clave de prefijo para tolerar variantes morfologicas (despido/despedido,
        // necesidades/caso de necesidad) en espanol juridico sin un stemmer completo.
        if (t.length >= 6) {
          const pref = t.slice(0, 5);
          mapa[pref] = (mapa[pref] || 0) + peso * 0.5;
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
    out.push({ ficha, regiones, blobFrase });
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
export type SlugCorpusArea = "laboral" | "civil" | "familia" | "penal" | "administrativo" | "constitucional" | "transversal";
const SLUGS_CORPUS_AREA = new Set<SlugCorpusArea>(["laboral", "civil", "familia", "penal", "administrativo", "constitucional", "transversal"]);

export function esSlugCorpusArea(a: string): boolean {
  return SLUGS_CORPUS_AREA.has(a.trim().toLowerCase() as SlugCorpusArea);
}

function corpusCompletoActivo(): boolean {
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
  const cache = indicePorArea.get(slug);
  if (cache) return cache;
  const corpus = getCorpusArea(slug);
  if (!corpus) return [];
  const idx = construirIndice(corpus);
  indicePorArea.set(slug, idx);
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
  slugArea?: string
): Promise<RecomendacionJuris[]> {
  try {
    const indiceL = getIndice().concat(getIndiceExtendido(slugArea));
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
    for (const { ficha, regiones, blobFrase } of indiceL) {
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
      resultados.push({
        institucion: ficha.institucion,
        materia: ficha.materia,
        autor: ficha.autor,
        obra: ficha.obra,
        falloRector: ficha.falloRector,
        normas: ficha.normas || [],
        dictamenes: ficha.fallos || [],
        definicion: ficha.definicion,
        puntuacion: Math.round(score * 100) / 100,
      });
    }
    resultados.sort((a, b) => b.puntuacion - a.puntuacion);
    return resultados.slice(0, maxResultados);
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
    s += `\n### ${i.institucion}\n`;
    if (i.materia) s += `Materia: ${i.materia}\n`;
    if (i.falloRector && i.falloRector.rol) {
      s += `Fallo rector CS: Rol ${i.falloRector.rol} de ${i.falloRector.fecha || "fecha no disp."}`;
      if (i.falloRector.extra) s += ` (${i.falloRector.extra})`;
      s += `\n`;
    }
    if (i.normas && i.normas.length) s += `Normas/complementariedades: ${i.normas.slice(0, 5).join(" · ")}\n`;
    if (i.definicion) s += `Estándar: ${i.definicion.slice(0, 420)}\n`;
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

export async function buscarCasosJuris(textos: string[], maxResultados = 4): Promise<RecomendacionCaso[]> {
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
    for (const { caso, mapa, blobFrase } of idx.docs) {
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
    return resultados
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
    s += `\n### ${c.tribunal}${c.sala ? ` — ${c.sala}` : ""}\n`;
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
  return Array.from(porInstitucion.values())
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, max);
}

export async function buscarJurisprudenciaMulti(consultas: ConsultaEtiquetada[], maxResultados = 6, slugArea?: string): Promise<RecomendacionJuris[]> {
  const validas = consultas.filter((c) => typeof c.texto === "string" && c.texto.trim().length >= 15);
  if (validas.length === 0) return [];
  const runs = await Promise.all(
    validas.map(async (c) => ({ consulta: c.etiqueta || "general", resultados: await buscarJurisprudencia([c.texto], 8, slugArea) }))
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

export async function buscarCasosJurisMulti(consultas: ConsultaEtiquetada[], maxResultados = 4): Promise<RecomendacionCaso[]> {
  const validas = consultas.filter((c) => typeof c.texto === "string" && c.texto.trim().length >= 15);
  if (validas.length === 0) return [];
  const runs = await Promise.all(
    validas.map(async (c) => ({ consulta: c.etiqueta || "general", resultados: await buscarCasosJuris([c.texto], 6) }))
  );
  return fusionarCasos(runs, maxResultados);
}
