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

// Exportadas para scripts/qa-semilla-bcn.ts (guardián de la semilla). El resto
// del código debe seguir usando verificarCitasBCN, no estas tablas a pelo.
export const NORMA_IDS: Record<string, { id: number; nombre: string; detect: RegExp }> = {
  // ── Códigos ────────────────────────────────────────────────────────────────
  // detect exige el DENOMINADOR del DFL (1/2000, 2/2003): el patrón anterior
  // ("DFL N" pelado) hacía que cualquier "DFL N° 1"/"DFL N° 2" del mundo cayera
  // en CC/CT. Verificación de TODAS las entradas: scripts/qa-semilla-bcn.ts.
  CC: { id: 172986, nombre: "Codigo Civil (DFL 1, 2000)", detect: /\bC[oó]digo\s+Civil\b|\bDFL\s*(?:N[°º.]?\s*)?1\s*(?:\/|de)?\s*2000\b/i },
  CP: { id: 1984, nombre: "Codigo Penal", detect: /\bC[oó]digo\s+Penal\b/i },
  CT: { id: 207436, nombre: "Codigo del Trabajo (DFL 2, 2003)", detect: /\bC[oó]digo\s+del\s+Trabajo\b|\bDFL\s*(?:N[°º.]?\s*)?2\s*(?:\/|de)?\s*2003\b/i },
  CPC: { id: 22740, nombre: "Codigo de Procedimiento Civil (Ley 1.552)", detect: /\bC[oó]digo\s+de\s+Procedimiento\s+Civil\b|\bLey\s*n?[°º.\s]*1\.?\s?552\b/i },
  CPP: { id: 176595, nombre: "Codigo Procesal Penal (Ley 19.696)", detect: /\bC[oó]digo\s+Procesal\s+Penal\b|\bLey\s*n?[°º.\s]*19\.?\s?696\b/i },
  CCom: { id: 1974, nombre: "Codigo de Comercio", detect: /\bC[oó]digo\s+de\s+Comercio\b/i },
  CTrib: { id: 6374, nombre: "Codigo Tributario (DL 830)", detect: /\bC[oó]digo\s+Tributario\b/i },
  CAguas: { id: 5605, nombre: "Codigo de Aguas (DFL 1122)", detect: /\bC[oó]digo\s+de\s+Aguas\b/i },
  CSan: { id: 5595, nombre: "Codigo Sanitario (DFL 725)", detect: /\bC[oó]digo\s+Sanitario\b/i },
  CMiner: { id: 29668, nombre: "Codigo de Mineria (Ley 18.248)", detect: /\bC[oó]digo\s+de\s+Miner[ií]a\b/i },
  CJM: { id: 18914, nombre: "Codigo de Justicia Militar (D. 2226)", detect: /\bC[oó]digo\s+de\s+Justicia\s+Militar\b/i },
  CAero: { id: 30287, nombre: "Codigo Aeronautico (Ley 18.916)", detect: /\bC[oó]digo\s+Aeron[aá]utico\b/i },
  LGUC: { id: 13560, nombre: "Ley General de Urbanismo y Construcciones (DFL 458)", detect: /\bLey\s+General\s+de\s+Urbanismo\b|\bLGUC\b/i },
  // ── Leyes especiales / sectoriales ─────────────────────────────────────────
  // Lote 2026-11-02: frecuencia medida sobre data/corpus-full (16,1 MB) + gap
  // de citas SIN número ("Ley del Consumidor", "Estatuto Administrativo") que
  // el canal genérico idLey no puede resolver. Cada idNorma verificado contra
  // el XML oficial (obtxml: <Tipo>, <Numero>, normaId y <TituloNorma>).
  L14908: { id: 27977, nombre: "Ley 14.908 (pensiones alimenticias)", detect: /\bLey\s*n?[°º.\s]*14\.?\s?908\b/i },
  L16744: { id: 28650, nombre: "Ley 16.744 (accidentes del trabajo)", detect: /\bLey\s*n?[°º.\s]*16\.?\s?744\b|\bLey\s+de\s+Accidentes\s+del\s+Trabajo\b/i },
  L17336: { id: 28933, nombre: "Ley 17.336 (propiedad intelectual)", detect: /\bLey\s*n?[°º.\s]*17\.?\s?336\b|\bLey\s+de\s+Propiedad\s+Intelectual\b/i },
  L18046: { id: 29473, nombre: "Ley 18.046 (sociedades anonimas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?046\b|\bLey\s+de\s+Sociedades\s+An[oó]nimas\b/i },
  L18101: { id: 29526, nombre: "Ley 18.101 (arrendamiento urbano)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?101\b/i },
  L18216: { id: 29636, nombre: "Ley 18.216 (penas sustitutivas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?216\b/i },
  L18287: { id: 29705, nombre: "Ley 18.287 (justicia de policia local)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?287\b/i },
  L18290: { id: 29708, nombre: "Ley 18.290 (transito)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?290\b/i },
  L18314: { id: 29731, nombre: "Ley 18.314 (conductas terroristas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?314\b/i },
  L18575: { id: 29967, nombre: "Ley 18.575 (bases generales de la administracion)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?575\b/i },
  L18695: { id: 30077, nombre: "Ley 18.695 (LOC de municipalidades)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?695\b|\bLey\s+Org[aá]nica\s+Constitucional\s+de\s+Municipalidades\b/i },
  L18834: { id: 30210, nombre: "Ley 18.834 (estatuto administrativo)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?834\b|\bEstatuto\s+Administrativo(?!\s+(?:Municipal|para\s+Funcionarios\s+Municipales))\b/i },
  L18883: { id: 30256, nombre: "Ley 18.883 (estatuto administrativo municipal)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?883\b|\bEstatuto\s+Administrativo\s+(?:Municipal|para\s+Funcionarios\s+Municipales)\b/i },
  L19039: { id: 30406, nombre: "Ley 19.039 (propiedad industrial)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?039\b|\bLey\s+de\s+Propiedad\s+Industrial\b/i },
  L19300: { id: 30667, nombre: "Ley 19.300 (bases del medio ambiente)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?300\b|\bLey\s+de\s+Bases\s+(?:Generales\s+)?del\s+Medio\s+Ambiente\b/i },
  L19496: { id: 61438, nombre: "Ley 19.496 (proteccion del consumidor)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?496\b|\bLey\s+del\s+Consumidor\b/i },
  L19628: { id: 141599, nombre: "Ley 19.628 (proteccion de la vida privada)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?628\b/i },
  // Ley Bustos: modifica art. 162 CT (cotizaciones al despido). idNorma verificado obtxml 2026-11-03.
  L19631: { id: 144318, nombre: "Ley 19.631 (Ley Bustos — cotizaciones al despido)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?631\b|\bLey\s+Bustos\b/i },
  L19880: { id: 210676, nombre: "Ley 19.880 (procedimiento administrativo)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?880\b/i },
  L19886: { id: 213004, nombre: "Ley 19.886 (compras publicas)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?886\b|\bLey\s+de\s+Compras\s+P[uú]blicas\b/i },
  L19947: { id: 225128, nombre: "Ley 19.947 (matrimonio civil)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?947\b|\bLey\s+de\s+Matrimonio\s+Civil\b/i },
  L19968: { id: 229557, nombre: "Ley 19.968 (familia)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?968\b/i },
  L20000: { id: 235507, nombre: "Ley 20.000 (trafico ilicito de estupefacientes)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?000\b|\bLey\s+de\s+Drogas\b/i },
  L20009: { id: 236736, nombre: "Ley 20.009 (fraudes tarjetas de pago)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?009\b/i },
  L20066: { id: 242648, nombre: "Ley 20.066 (violencia intrafamiliar)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?066\b|\bLey\s+de\s+Violencia\s+Intrafamiliar\b/i },
  L20084: { id: 244803, nombre: "Ley 20.084 (responsabilidad penal adolescente)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?084\b/i },
  L20720: { id: 1058072, nombre: "Ley 20.720 (reorganizacion y liquidacion)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?720\b/i },
  L21325: { id: 1158549, nombre: "Ley 21.325 (migracion y extranjeria)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?325\b|\bLey\s+de\s+Migraci[oó]n\b/i },
  L21430: { id: 1173643, nombre: "Ley 21.430 (garantias y proteccion de la ninez)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?430\b/i },
  L21561: { id: 1191554, nombre: "Ley 21.561 (reduccion de jornada, 40 horas)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?561\b|\bLey\s+de\s+40\s+Horas\b/i },
  L21643: { id: 1200096, nombre: "Ley 21.643 (Ley Karin, acoso laboral)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?643\b|\bLey\s+Karin\b/i },
  L21719: { id: 1209272, nombre: "Ley 21.719 (proteccion de datos personales)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?719\b/i },
};

// Leyes notorias citadas por NUMERO que conviene tener resueltas sin pasar por
// el canal genérico idLey (ahorra 1 consulta y evita el tope MAX_GENERICOS).
// VALOR = idNorma VERIFICADO contra el XML oficial (2026-11-02,
// scripts/qa-semilla-bcn.ts). ANTES este mapa guardaba el NUMERO DE LEY en el
// campo idNorma: "Ley 18.916" descargaba idNorma=18916 = "Decreto 2226:
// pension por gracia a Santiago Florio Cvitanic" — texto de OTRO cuerpo
// inyectado como verdad normativa (hallazgo de la auditoria de semilla).
// "Ley 8.274" no existe en el indice de Ley Chile (idLey=8274 responde vacio):
// esa etiqueta falsa se elimino; el Codigo de Justicia Militar (Decreto 2226,
// idNorma 18914) vive ahora en NORMA_IDS detectado por su nombre.
const LEY_EXTRA: Record<string, { nombre: string; idNorma: number }> = {
  "18916": { nombre: "Codigo Aeronautico (Ley 18.916)", idNorma: 30287 },
  "18248": { nombre: "Codigo de Mineria (Ley 18.248)", idNorma: 29668 },
};
export { LEY_EXTRA };

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

async function fetchXMLOnce(id: number, byLey = false): Promise<string> {
  const url = byLey
    ? `https://www.leychile.cl/Consulta/obtxml?opt=7&idLey=${id}`
    : `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${id}`;
  // La cuota diaria cuenta INTENTOS (no solo exitos): es la cortesia real
  // hacia leychile (un retry cuenta como consulta).
  registrarConsulta();
  const res = await fetch(url, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (uso verificacion normativa; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!ct.includes("xml") && !body.includes("<Identificador") && !body.includes("<Norma")) throw new Error("obtxml sin XML");
  return body;
}

// ── Resiliencia de ingesta BCN (2026-10-29, auditoria post-prod) ────────────
// Evidencia: prod funciona (draft con citas -> XML oficial vigente), pero un
// blip transitorio (conn refused, 5xx, HTML sin XML) dejaba el bloque BCN
// ciego para ese draft: 1 solo intento, error cacheado 3 min en la lambda y
// catchs silenciosos. Ahora: 1 retry SOLO si la falla fue rapida (<5s). Un
// timeout largo (25s) NO se reintenta para no duplicar la latencia del draft.
// maxMs inyectable para QA determinista.
export const RETRY_UMBRAL_MS = 5000;

export async function conReintentosRapido(fn: () => Promise<string>, maxMs: number = RETRY_UMBRAL_MS): Promise<string> {
  const t0 = Date.now();
  try {
    return await fn();
  } catch (e) {
    if (Date.now() - t0 >= maxMs) throw e;
    return await fn();
  }
}

function fetchXML(id: number, byLey = false): Promise<string> {
  return conReintentosRapido(() => fetchXMLOnce(id, byLey));
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
    // Supabase: CA propia no incluida en Node (ver orderStore).
    const pool: PgPool = new mod.Pool({ connectionString: url, ssl: url.includes("sslmode=") ? { rejectUnauthorized: false } : undefined, max: 2, connectionTimeoutMillis: 8000 });
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
    const extra = LEY_EXTRA[numNorma];
    out.push({
      key: `LEY${numNorma}`,
      nombre: extra ? extra.nombre : undefined,
      idNorma: extra ? extra.idNorma : null,
      leyNum: numNorma,
      idx: spanA, end: spanB,
      resuelta: Boolean(extra),
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
