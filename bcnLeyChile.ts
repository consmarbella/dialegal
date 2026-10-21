// Verificacion normativa determinista contra Ley Chile (BCN), para la capa premium.
// Canal: servicios legacy de Ley Chile (obtxml), que no requieren API key.
// API v1 (BCN_API_KEY) esta activada? no: la key entregada responde 401 incluso en
// endpoints basicos, por lo que el motor base es el canal legacy; si la key se activa
// puede migrarse a /api/v1 (servicio 7) sin cambiar la interfaz.

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
  motivo: "articulo_no_encontrado" | "norma_no_disponible" | "limite_diario";
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

const LIMITA_DIARIO = 300;
const TTL_NORMA = 24 * 60 * 60 * 1000;

interface NormaCacheEntry { xml: string; fechaVersion: string; derogado: boolean; fetchedAt: number; }
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

async function fetchXML(idNorma: number): Promise<string> {
  const url = `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${idNorma}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (uso verificacion normativa; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!ct.includes("xml") && !body.includes("<Norma")) throw new Error("obtxml sin XML");
  registrarConsulta();
  return body;
}

async function getNorma(idNorma: number): Promise<NormaCacheEntry | null> {
  const cached = normaCache.get(idNorma);
  if (cached) {
    if ("ok" in cached && Date.now() - cached.ok.fetchedAt < TTL_NORMA) return cached.ok;
    if ("error" in cached && Date.now() - cached.fetchedAt < 3 * 60 * 1000) return null;
  }
  try {
    const xml = await fetchXML(idNorma);
    const enc = xml.slice(0, 4000);
    const fvM = enc.match(/fechaVersion="([0-9-]{8,10})"/);
    const derM = enc.match(/derogado="([^"]+)"/);
    const entry: NormaCacheEntry = {
      xml,
      fechaVersion: fvM ? decodeXml(fvM[1]) : "",
      derogado: derM ? decodeXml(derM[1]).startsWith("derogado") : false,
      fetchedAt: Date.now(),
    };
    normaCache.set(idNorma, { ok: entry });
    return entry;
  } catch {
    normaCache.set(idNorma, { error: "fetch", fetchedAt: Date.now() });
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

function escReg(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export async function verificarCitasBCN(textos: string[]): Promise<{ verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] }> {
  const texto = textos.filter(Boolean).join("\n");
  if (!texto) return { verificados: [], pendientes: [] };

  const cuerpos: Array<{ key: string; idx: number }> = [];
  for (const [key, def] of Object.entries(NORMA_IDS)) {
    const re = new RegExp(def.detect.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) cuerpos.push({ key, idx: m.index });
  }
  const citas = texto
    .replace(/\s{3,}(?:L\.?\s*\d|D\.?(?:F\.)?L\.|D\.O\.)[^\n]*$/gm, "")
    .replace(/\s{3,}(?:Art(?:\.|ículo)?\s*\d+[^\n]*)$/gm, "");
  const arts: Array<{ n: string; idx: number }> = [];
  let am: RegExpExecArray | null;
  ART_RE.lastIndex = 0;
  while ((am = ART_RE.exec(citas)) !== null) arts.push({ n: am[1], idx: am.index });
  if (cuerpos.length === 0 || arts.length === 0) return { verificados: [], pendientes: [] };

  const citadas = new Map<string, Set<string>>();
  for (const a of arts) {
    const despues = cuerpos
      .filter((c) => c.idx > a.idx && c.idx - a.idx < 120)
      .sort((x, y) => x.idx - y.idx)[0];
    const elegido = despues ?? cuerpos.filter((c) => c.idx < a.idx && a.idx - c.idx < 400).sort((x, y) => y.idx - x.idx)[0];
    if (!elegido) continue;
    let set = citadas.get(elegido.key);
    if (!set) { set = new Set(); citadas.set(elegido.key, set); }
    if (set.size < 12) set.add(normNum(a.n));
  }

  const verificados: BcnArticuloVerificado[] = [];
  const pendientes: BcnNormaSinArticulo[] = [];

  for (const [key, numeros] of citadas) {
    const def = NORMA_IDS[key];
    if (!def) continue;
    const norma = puedeConsultar() ? await getNorma(def.id) : null;
    if (!norma) {
      pendientes.push({
        keyNorma: key, nombreNorma: def.nombre, idNorma: def.id,
        articulosPedidos: Array.from(numeros),
        motivo: puedeConsultar() ? "norma_no_disponible" : "limite_diario",
      });
      continue;
    }
    const partes = extraerPartes(norma.xml);
    const pedidos = Array.from(numeros);
    const faltantes: string[] = [];
    for (const num of pedidos) {
      const parte = partes.find((p) => {
        const nom = p.nombre ? normNum(p.nombre) : "";
        if (nom === num) return true;
        const head = p.texto.match(/^(?:Art(?:[íi]culo|\.)\s*)?(\d{1,4})/i);
        return Boolean(head) && normNum(head![1]) === num;
      });
      if (!parte || !parte.texto) { faltantes.push(num); continue; }
      verificados.push({
        keyNorma: key,
        nombreNorma: def.nombre,
        idNorma: def.id,
        articulo: num,
        idParte: parte.idParte,
        vigente: !norma.derogado,
        fechaVersion: norma.fechaVersion,
        texto: parte.texto.slice(0, 1600),
        url: `https://www.bcn.cl/leychile/navegar?idNorma=${def.id}${parte.idParte ? `&idParte=${parte.idParte}` : ""}`,
      });
    }
    if (faltantes.length === pedidos.length) {
      pendientes.push({
        keyNorma: key, nombreNorma: def.nombre, idNorma: def.id,
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
