// Verificacion normativa determinista contra Ley Chile (BCN).
// Canal base: servicios legacy de Ley Chile (obtxml), que no requieren API key.
// API v1 (BCN_API_KEY) esta activada? no: la key entregada responde 401 incluso en
// endpoints basicos, por lo que el motor base es el canal legacy; si la key se activa
// puede migrarse a /api/v1 (servicio 7) sin cambiar la interfaz.
//
// Fase 4 — resolucion generica de leyes:
// - Ademas de la tabla semilla NORMA_IDS (los cuerpos mas citados), CUALQUIER
//   "Ley N. X.XXX" detectada en el texto se resuelve con el canal documentado
//   `obtxml?opt=7&idLey=<numero>` (verificado 2026-10-22: idLey=18290 -> XML
//   completo con <Tipo>Ley</Tipo><Numero>18290</Numero> y normaId="29708").
//   El Identificador del XML SE VERIFICA que sea Tipo=Ley con ese numero exacto
//   (evita resolver "DL 2.306" u "DFL" contra una "Ley 2.306" distinta que vive
//   en otro id). DFL/DL genericos y codigos fuera de la semilla NO se resuelven
//   por este canal; quedan como pendientes con motivo "norma_no_resoluble".
// - El indice nombre->idNorma se persiste en la tabla `leyes` de Postgres
//   (si DATABASE_URL existe). La cache de XML en proceso (TTL 24h) sigue
//   siendo solo para no redescargar el mismo cuerpo.
export interface BcnArticuloVerificado {
  keyNorma: string;
  nombreNorma: string;
  idNorma: number;
  articulo: string;
  idParte?: string;
  vigente: boolean;
  fechaVersion?: string;
  texto: string;
  url: string;
}

export interface BcnNormaSinArticulo {
  keyNorma: string;
  nombreNorma: string;
  idNorma: number;
  articulosPedidos: string[];
  motivo: "articulo_no_encontrado" | "norma_no_disponible" | "limite_diario" | "norma_no_resoluble";
}

const NORMA_IDS: Record<string, { id: number; nombre: string; detect: RegExp }> = {
  CC: { id: 172986, nombre: "Codigo Civil (DFL 1, 2000)", detect: /C[oó]digo\s+Civil|DFL\s*n?[°º.\s]?1[^0-9]/i },
  CP: { id: 1984, nombre: "Codigo Penal", detect: /C[oó]digo\s+Penal/i },
  CT: { id: 207436, nombre: "Codigo del Trabajo (DFL 1, 2003)", detect: /C[oó]digo\s+del\s+Trabajo|\bDFL\s*n?[°º.\s]?2[^0-9]/i },
  CPC: { id: 22740, nombre: "Codigo de Procedimiento Civil (Ley 1.552)", detect: /C[oó]digo\s+de\s+Procedimiento\s+Civil|\bLey\s*n?[°º.\s]*1\.?\s?552\b/i },
  CPP: { id: 176595, nombre: "Codigo Procesal Penal (Ley 19.696)", detect: /C[oó]digo\s+Procesal\s+Penal|\bLey\s*n?[°º.\s]*19\.?696\b/i },
  L14908: { id: 27977, nombre: "Ley 14.908 (pensiones alimenticias)", detect: /Ley\s*n?[°º.\s]*14\.?\s?908/i },
  L18101: { id: 29526, nombre: "Ley 18.101 (arrendamiento urbano)", detect: /Ley\s*n?[°º.\s]*18\.?\s?101/i },
  L18287: { id: 29705, nombre: "Ley 18.287 (justicia de policia local)", detect: /Ley\s*n?[°º.\s]*18\.?\s?287/i },
  L18290: { id: 29708, nombre: "Ley 18.290 (transito)", detect: /Ley\s*n?[°º.\s]*18\.?\s?290/i },
  L19968: { id: 229557, nombre: "Ley 19.968 (familia)", detect: /Ley\s*n?[°º.\s]*19\.?\s?968/i },
  L20720: { id: 1058072, nombre: "Ley 20.720 (reorganizacion y liquidacion)", detect: /Ley\s*n?[°º.\s]*20\.?\s?720/i },
};

// Codigos famosos fuera de la semilla (notorias, verificados con idLey):
const LEY_EXTRA: Record<string, number> = {
  "Ley 18.916 (Codigo Aeronautico)": 18916,
  "Ley 8.274 (Codigo de Justicia Militar)": 8274,
};

const LIMITA_DIARIO = 300;
const TTL_NORMA = 24 * 60 * 60 * 1000;

interface NormaCacheEntry { xml: string; fechaVersion: string; derogado: boolean; normaId?: number; fetchedAt: number; }
type NormaCacheState = { ok: NormaCacheEntry } | { error: string; fetchedAt: number };

const normaCache = new Map<number, NormaCacheState>();
let contadorDiario = 0;
let contadorDia = "";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function puedeConsultar(): boolean {
  const d = hoy();
  if (contadorDia !== d) { contadorDia = d; contadorDiario = 0; }
  return contadorDiario < LIMITA_DIARIO;
}

function registrarConsulta(): void {
  contadorDiario += 1;
}

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d: string) => {
      const n = parseInt(d, 10);
      if (n === 160) return " ";
      try { return String.fromCharCode(n); } catch { return " "; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => {
      const n = parseInt(h, 16);
      if (n === 160) return " ";
      try { return String.fromCharCode(n); } catch { return " "; }
    })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function quitarTags(s: string): string {
  return s.replace(/<\/?[A-Za-z][^>]*>/g, "");
}

function limpiarTexto(s: string): string {
  return quitarTags(decodeXml(s))
    .replace(/\r/g, "")
    .replace(/\s{3,}(?:L\.\s*\d|D\.?(?:F\.)?L\.\s*\d|D\.O\.)[^\n]*$/gm, "")
    .split("\n")
    .map((l) => {
      const t = l.trim();
      if (!t) return "";
      if (/^\d+(?:[.,)]\s*)?$/.test(t)) return "";
      if (t.length <= 26 && /^(?:L\.|D\.?L\.|D\.F\.L\.|D\.O\.|Ley\s|Art\.(?:\s|\d)*$)/i.test(t)) return "";
      return t;
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchXML(id: number, byLey = false): Promise<string> {
  const url = byLey
    ? `https://www.leychile.cl/Consulta/obtxml?opt=7&idLey=${id}`
    : `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${id}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (uso verificacion normativa; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!ct.includes("xml") && !body.includes("<Identificador") && !body.includes("<Norma")) throw new Error("obtxml sin XML");
  registrarConsulta();
  return body;
}

async function getNorma(id: number, byLey = false): Promise<NormaCacheEntry | null> {
  const cached = normaCache.get(id);
  if (cached) {
    if ("ok" in cached && Date.now() - cached.ok.fetchedAt < TTL_NORMA) return cached.ok;
    if ("error" in cached && Date.now() - cached.fetchedAt < 3 * 60 * 1000) return null;
  }
  try {
    const xml = await fetchXML(id, byLey);
    const enc = xml.slice(0, 4000);
    const fvM = enc.match(/fechaVersion="([0-9-]{8,10})"/);
    const derM = enc.match(/derogado="([^"]+)"/);
    const niM = xml.match(/normaId="(\d+)"/);
    const entry: NormaCacheEntry = {
      xml,
      fechaVersion: fvM ? decodeXml(fvM[1]) : "",
      derogado: derM ? decodeXml(derM[1]).startsWith("derogado") : false,
      // El normaId canónico vive más allá del encabezado (en normas grandes
      // queda fuera de los primeros 4000 chars): se busca en TODO el cuerpo.
      normaId: niM ? parseInt(niM[1], 10) : undefined,
      fetchedAt: Date.now(),
    };
    normaCache.set(id, { ok: entry });
    return entry;
  } catch {
    normaCache.set(id, { error: "fetch", fetchedAt: Date.now() });
    return null;
  }
}

function extraerPartes(xml: string): Array<{ idParte?: string; nombre?: string; texto: string }> {
  const out: Array<{ idParte?: string; nombre?: string; texto: string }> = [];
  const re = /<EstructuraFuncional[^>]*tipoParte="Art(?:[^\w>]|&#\d+;|[^\s>])*[^>]*>([\s\S]*?)<\/EstructuraFuncional>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attr = m[0].slice(0, m[0].indexOf(">"));
    const idParteM = attr.match(/idParte="(\d+)"/);
    const nombreM = m[1].match(/<NombreParte[^>]*>([\s\S]*?)<\/NombreParte>/);
    const textoM = m[1].match(/<Texto>([\s\S]*?)<\/Texto>/);
    out.push({
      idParte: idParteM ? idParteM[1] : undefined,
      nombre: nombreM ? limpiarTexto(nombreM[1]) : undefined,
      texto: textoM ? limpiarTexto(textoM[1]) : "",
    });
  }
  return out;
}

function normNum(s: string): string {
  return decodeXml(s).trim().replace(/[°º\s]+$/g, "").replace(/^0+/, "").replace(/\./g, "");
}

const ART_RE = /(?:art[ií]culo|arts?\.?)\s*(\d{1,4})\s*[°º]?/gi;

// ====== Fase 4: indice de leyes en Postgres (si DATABASE_URL existe) ======
// Tabla leyes: numero de ley -> idNorma canónico. La resolución de una ley
// apenas cambia (ids estables), por eso vive en DB y no en caché efímera.
type PgPool = { query: (sql: string, vals?: any[]) => Promise<{ rows: any[] }> };
let leyesPool: PgPool | null = null;
let leyesSchemaP: Promise<void> | null = null;
let warnedDbLeyes = false;

async function getLeyesPool(): Promise<PgPool | null> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (leyesPool) return leyesPool;
  try {
    const mod: any = await import("pg");
    const pool: PgPool = new mod.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 8000 });
    leyesSchemaP = pool
      .query(`CREATE TABLE IF NOT EXISTS leyes (
         ley_num     INTEGER PRIMARY KEY,
         tipo        TEXT,
         numero      TEXT,
         nombre      TEXT,
         idnorma     BIGINT NOT NULL,
         resuelto_en TIMESTAMPTZ NOT NULL DEFAULT now()
       );`)
      .then(() => undefined)
      .catch((e: any) => { leyesSchemaP = null; throw e; });
    leyesPool = pool;
    return pool;
  } catch (e: any) {
    warnDbLeyes(`No se abrió el índice de leyes en DB (${String(e?.message || e).slice(0, 120)}). Sigo con el índice en memoria.`);
    return null;
  }
}

function warnDbLeyes(msg: string): void {
  if (warnedDbLeyes) return;
  console.error(`[leyes] ${msg}`);
  warnedDbLeyes = true;
}

// resolverLeyGenerica: resuelve "Ley N° X" -> { idNorma canónico, nombre }.
// Capas: (1) memoria de proceso, (2) tabla leyes de Postgres, (3) Ley Chile
// vía idLey (verificando Tipo=Ley y Numero=X) y persistencia en DB.
const resolucionMem = new Map<string, { idNorma: number; nombre: string }>();
const resolucionFallada = new Map<string, number>();
const FALLA_TTL = 30 * 60 * 1000;

async function resolverLeyGenerica(leyNum: string): Promise<{ idNorma: number; nombre: string } | null> {
  // Tolera "18.290", "18290" y "Ley 18575" (parseInt pelado corta los miles).
  const numNorma = String(parseInt(String(leyNum).replace(/\./g, ""), 10));
  if (!numNorma || numNorma === "NaN") return null;
  const mem = resolucionMem.get(numNorma);
  if (mem) return mem;
  const falla = resolucionFallada.get(numNorma);
  if (falla && Date.now() - falla < FALLA_TTL) return null;

  // (2) índice persistente
  try {
    const pool = await getLeyesPool();
    if (pool && leyesSchemaP) await leyesSchemaP;
    if (pool) {
      const r = await pool.query(`SELECT idnorma, nombre FROM leyes WHERE ley_num = $1 LIMIT 1`, [parseInt(numNorma, 10)]);
      if (r.rows[0]) {
        const hit = { idNorma: Number(r.rows[0].idnorma), nombre: String(r.rows[0].nombre || `Ley ${numNorma}`) };
        resolucionMem.set(numNorma, hit);
        return hit;
      }
    }
  } catch (e: any) {
    warnDbLeyes(`Lectura del índice de leyes falló (${String(e?.message || e).slice(0, 120)}). Sigo con la resolución en vivo.`);
  }

  // (3) canal directo idLey
  if (!puedeConsultar()) return null;
  try {
    const entry = await getNorma(parseInt(numNorma, 10), true);
    if (!entry) { resolucionFallada.set(numNorma, Date.now()); return null; }
    // Verificación del Identificador: el cuerpo DEBE ser una Ley con ese num.
    const idm = entry.xml.slice(0, 4000).match(/<Tipo>\s*([A-Za-zÓóÉé\.Áá\s]+?)\s*<\/Tipo>\s*<Numero>\s*(\d+)\s*<\/Numero>/);
    const tipo = idm ? decodeXml(idm[1]).trim() : "";
    const num = idm ? idm[2] : "";
    if (tipo !== "Ley" || num !== numNorma) {
      resolucionFallada.set(numNorma, Date.now());
      return null; // DL/DFL no debe cachearse como si fuera esta Ley.
    }
    const tituloM = entry.xml.slice(0, 20000).match(/<TituloNorma[^>]*>([\s\S]{0,300}?)<\/TituloNorma>/);
    const nombre = tituloM ? limpiarTexto(tituloM[1]).slice(0, 100) : `Ley ${numNorma}`;
    const idNorma = entry.normaId || parseInt(numNorma, 10);
    const hit = { idNorma, nombre };
    resolucionMem.set(numNorma, hit);
    // Sembrar la caché bajo el idNorma canónico: el fetch posterior del
    // articulado (getNorma(idNorma)) reutiliza este XML en vez de re-descargar.
    if (entry.normaId) normaCache.set(entry.normaId, { ok: entry });
    // Persistir en DB (fire and forget: no bloquea la respuesta).
    try {
      const pool = await getLeyesPool();
      if (pool) {
        if (leyesSchemaP) await leyesSchemaP;
        await pool.query(
          `INSERT INTO leyes (ley_num, tipo, numero, nombre, idnorma) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (ley_num) DO UPDATE SET tipo=EXCLUDED.tipo, numero=EXCLUDED.numero, nombre=EXCLUDED.nombre, idnorma=EXCLUDED.idnorma, resuelto_en=now()`,
          [parseInt(numNorma, 10), tipo, num, nombre, idNorma]
        );
      }
    } catch (e: any) {
      warnDbLeyes(`Escritura del índice de leyes falló (${String(e?.message || e).slice(0, 120)}).`);
    }
    return hit;
  } catch {
    resolucionFallada.set(numNorma, Date.now());
    return null;
  }
}

// ====== Fase 4: cruce articulo <-> norma (determinístico, sin red) ======
// Union de la tabla semilla + patrones genericos "Ley N° X.XXX" (+ fuentes extra).
export interface NormaDetectada { key: string; nombre?: string; idNorma: number | null; leyNum?: string; idx: number; end: number; resuelta: boolean; }
export interface CitaPareada { num: string; idx: number; norma: NormaDetectada | null; }

function detectarNormas(textoPost: string): NormaDetectada[] {
  const out: NormaDetectada[] = [];
  for (const [key, def] of Object.entries(NORMA_IDS)) {
    const re = new RegExp(def.detect.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(textoPost)) !== null) {
      out.push({ key, nombre: def.nombre, idNorma: def.id, idx: m.index, end: m.index + m[0].length, resuelta: true });
    }
  }
  const reLey = /\bLey\s*(?:N[°º.]?\s*)?(\d{1,2}(?:\.\d{3})|\d{4,5})\b/gi;
  let lm: RegExpExecArray | null;
  while ((lm = reLey.exec(textoPost)) !== null) {
    const numNorma = String(parseInt(lm[1].replace(/\./g, ""), 10));
    // skip si este span ya lo cubre al semilla (evita duplicar "Ley 18.290").
    const spanA = lm.index, spanB = lm.index + lm[0].length;
    if (out.some((n) => n.resuelta && spanA >= n.idx - 8 && spanB <= n.end + 8)) continue;
    const extraId = Object.entries(LEY_EXTRA).find(([, id]) => id === parseInt(numNorma, 10));
    out.push({
      key: `LEY${numNorma}`,
      nombre: extraId ? extraId[0] : undefined,
      idNorma: extraId ? extraId[1] : null,
      leyNum: numNorma,
      idx: spanA, end: spanB,
      resuelta: Boolean(extraId),
    });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

export function extraerCitadasPorNorma(texto: string): { pares: CitaPareada[]; sinNorma: string[]; normas: NormaDetectada[] } {
  const textoLimpio = texto
    .replace(/\s{3,}(?:L\.?\s*\d|D\.?(?:F\.)?L\.|D\.O\.)[^\n]*$/gm, "")
    .replace(/\s{3,}(?:Art(?:\.|ículo)?\s*\d+[^\n]*)$/gm, "");
  const normas = detectarNormas(textoLimpio);
  const arts: Array<{ n: string; idx: number }> = [];
  let am: RegExpExecArray | null;
  ART_RE.lastIndex = 0;
  while ((am = ART_RE.exec(textoLimpio)) !== null) arts.push({ n: am[1], idx: am.index });
  const pares: CitaPareada[] = [];
  const contadas = new Map<string, number>(); // cuenta de usos por keyNorma
  for (const a of arts) {
    // ventana de emparejamiento: primero el cuerpo mas cercano DESPUES del
    // articulo ("Art. 1 de la Ley X") hasta 120 chars; si no hay, el cuerpo
    // anterior mas cercano ("... Ley X ... Art. 1") hasta 400 chars atras.
    const despues = normas
      .filter((n) => n.idx > a.idx && n.idx - a.idx < 120)
      .sort((x, y) => x.idx - y.idx)[0];
    const anterior = normas.filter((c) => c.idx < a.idx && a.idx - c.idx < 400).sort((x, y) => y.idx - x.idx)[0];
    const elegida = despues ?? anterior ?? null;
    if (elegida) {
      const c = contadas.get(elegida.key) || 0;
      if (c < 12) { pares.push({ num: normNum(a.n), idx: a.idx, norma: elegida }); contadas.set(elegida.key, c + 1); }
      else pares.push({ num: normNum(a.n), idx: a.idx, norma: null });
    } else {
      pares.push({ num: normNum(a.n), idx: a.idx, norma: null });
    }
  }
  // arts que quedaron sin norma: los distintos
  const sinNorma: string[] = [];
  for (const p of pares) if (!p.norma && !sinNorma.includes(p.num)) sinNorma.push(p.num);
  return { pares, sinNorma: sinNorma.slice(0, 20), normas };
}

export async function verificarCitasBCN(textos: string[]): Promise<{ verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] }> {
  const texto = textos.filter(Boolean).join("\n");
  if (!texto) return { verificados: [], pendientes: [] };

  const { pares, normas } = extraerCitadasPorNorma(texto);
  if (!pares.length) return { verificados: [], pendientes: [] };

  // Resolver las normas genericas (idLey) que tengan al menos un articulo pareado.
  // Tope por llamada: el texto del usuario puede citar muchas leyes y cada
  // resolucion cuesta una descarga BCN (latencia + cuota diaria).
  const MAX_GENERICOS = 8;
  let genericasResueltas = 0;
  for (const n of normas) {
    if (n.resuelta || !n.leyNum) continue;
    if (!pares.some((p) => p.norma === n)) continue;
    if (!puedeConsultar() || genericasResueltas >= MAX_GENERICOS) { n.resuelta = false; continue; }
    genericasResueltas += 1;
    const r = await resolverLeyGenerica(n.leyNum);
    if (r) { n.idNorma = r.idNorma; n.nombre = r.nombre; n.resuelta = true; }
    else n.resuelta = false;
  }

  const verificados: BcnArticuloVerificado[] = [];
  const pendientes: BcnNormaSinArticulo[] = [];
  const vistas = new Map<string, Set<string>>(); // keyNorma -> art nums pendientes de resolver

  for (const p of pares) {
    if (!p.norma) continue;
    let setV = vistas.get(p.norma.key);
    if (!setV) { setV = new Set(); vistas.set(p.norma.key, setV); }
    if (!setV.has(p.num) && setV.size < 12) setV.add(p.num);
  }

  for (const [key, numeros] of vistas) {
    const n = normas.find((x) => x.key === key);
    if (!n) continue;
    const articulos = Array.from(numeros);
    const idNorma = n.idNorma;
    const nombre = n.nombre || `Ley ${n.leyNum || key}`;
    if (!idNorma || !n.resuelta) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma: idNorma || 0,
        articulosPedidos: articulos,
        motivo: !puedeConsultar() ? "limite_diario" : "norma_no_resoluble",
      });
      continue;
    }
    const norma = puedeConsultar() ? await getNorma(idNorma) : null;
    if (!norma) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma,
        articulosPedidos: articulos,
        motivo: puedeConsultar() ? "norma_no_disponible" : "limite_diario",
      });
      continue;
    }
    const partes = extraerPartes(norma.xml);
    const faltantes: string[] = [];
    for (const num of articulos) {
      const parte = partes.find((p) => {
        const nom = p.nombre ? normNum(p.nombre) : "";
        if (nom === num) return true;
        const head = p.texto.match(/^(?:Art(?:[íi]culo|\.)\s*)?(\d{1,4})/i);
        return Boolean(head) && normNum(head![1]) === num;
      });
      if (!parte || !parte.texto) { faltantes.push(num); continue; }
      verificados.push({
        keyNorma: key,
        nombreNorma: nombre,
        idNorma,
        articulo: num,
        idParte: parte.idParte,
        vigente: !norma.derogado,
        fechaVersion: norma.fechaVersion,
        texto: parte.texto.slice(0, 1600),
        url: `https://www.bcn.cl/leychile/navegar?idNorma=${idNorma}${parte.idParte ? `&idParte=${parte.idParte}` : ""}`,
      });
    }
    if (faltantes.length === articulos.length) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma,
        articulosPedidos: faltantes, motivo: "articulo_no_encontrado",
      });
    }
  }

  verificados.sort((a, b) => a.nombreNorma.localeCompare(b.nombreNorma) || Number(a.articulo) - Number(b.articulo));
  return { verificados, pendientes };
}

export function fechaConsultaBCN(fechas: string[]): string {
  if (fechas.length === 0) return new Date().toISOString().slice(0, 10);
  return fechas.sort().reverse()[0];
}

export function bloquePromptBCN(v: { verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] }): string {
  if (v.verificados.length === 0 && v.pendientes.length === 0) return "";
  const fecha = fechaConsultaBCN(v.verificados.map((x) => x.fechaVersion).filter(Boolean));
  let s = `\n\nVERIFICACION NORMATIVA OFICIAL (Ley Chile - BCN, consultado el ${fecha}). ` +
    `Estos textos fueron extraidos del XML oficial de Ley Chile Y SON FUENTE MAS PRIORITARIA QUE CUALQUIER RESULTADO DE BUSQUEDA WEB. ` +
    `Usalos como VERDAD NORMATIVA al revisar articulos citados en el dictamen:\n`;
  for (const a of v.verificados.slice(0, 24)) {
    s += `\n[ACTUAL ${a.fechaVersion || ""}] ${a.nombreNorma}, Art. ${a.articulo}:\n${a.texto}\n`;
  }
  if (v.pendientes.length > 0) {
    s += `\nCuerpos citados que NO se pudieron validar por este canal (verificalos con la web como antes):\n`;
    for (const p of v.pendientes.slice(0, 12)) {
      s += `- ${p.nombreNorma} (arts. ${p.articulosPedidos.join(", ")})\n`;
    }
  }
  s += `\nSi el dictamen contradice el texto ACTUAL que ves arriba, senalalo expresamente con la seccion 2 ("verificado en Ley Chile - BCN").\n`;
  return s;
}

export const ATRIBUCION_BCN = "Fuente: Ley Chile - Biblioteca del Congreso Nacional de Chile (BCN), consultado el {fecha}. Textos con licencia CC BY-NC-ND 4.0.";
