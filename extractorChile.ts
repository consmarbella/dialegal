// Extractor local determinista para documentos jurí­dicos chilenos (demandas,
// escritos, sentencias). Sin IA: regex + heurísticas de encabezados. Salida:
// secciones del plano de lectura, artefactos (normas+arts, montos, fechas,
// RUT, juzgado) y accion(es) detectadas. Nunca arroja.

export interface ParNormaArt {
  keyNorma: string;
  nombreNorma: string;
  articulo: string;
}

export interface ExtractoChileno {
  secciones: { hechos: string; derecho: string; petitorio: string };
  articulosInvocados: string[];
  normasDetectadas: Array<{ key: string; nombre: string }>;
  pares: ParNormaArt[];
  montos: string[];
  fechas: string[];
  rut: string[];
  juzgado: string;
  acciones: string[];
  longitudEntrada: number;
}

const NORMAS: Record<string, { nombre: string; re: RegExp }> = {
  CT: { nombre: "Código del Trabajo", re: /C[oó]digo\s+del\s+Trabajo|\bDFL\s*(?:N[°º.\s]*)?2\s*(?:\/|de)?\s*2003\b/i },
  CPC: { nombre: "Código de Procedimiento Civil", re: /C[oó]digo\s+de\s+Procedimiento\s+Civil/i },
  CC: { nombre: "Código Civil", re: /C[oó]digo\s+Civil/i },
  CP: { nombre: "Código Penal", re: /C[oó]digo\s+Penal/i },
  CPP: { nombre: "Código Procesal Penal", re: /C[oó]digo\s+Procesal\s+Penal/i },
  L21643: { nombre: "Ley 21.643 (Ley Karin)", re: /Ley\s*21\.?\s?643|Ley\s*Karin/i },
  L19728: { nombre: "Ley 19.728 (Seguro de Cesantía)", re: /Ley\s*19\.?\s?728/i },
  L20806: { nombre: "Ley 20.806 (marco laboral)", re: /Ley\s*20\.?\s?806/i },
  L19968: { nombre: "Ley 19.968 (familia)", re: /Ley\s*19\.?\s?968/i },
  L14908: { nombre: "Ley 14.908 (alimentos)", re: /Ley\s*14\.?\s?908/i },
  L21547: { nombre: "Ley 21.547 (seguridad social)", re: /Ley\s*21\.?\s?547/i },
  L18290: { nombre: "Ley 18.290 (tránsito)", re: /Ley\s*18\.?\s?290/i },
};

// ── Fase I: acciones con desambiguación por ORACIÓN ─────────────────────────
// Una acción ya no se dispara por una palabra suelta: si el patrón es
// ambiguo ("multa", "monitorio", "contratista", "tutela", "acoso"), exige
// átomos vecinos en la misma oración (o en la inmediatamente anterior/
// posterior) que confirmen de qué acción se trata, y puede vetarse si
// aparecen átomos que revelan otro sentido ("lucro cesante" veta el
// monitorio de arrendamiento: "rentas de arrendamiento NO PERCIBIDAS" es
// lucro cesante de un caso de construcción, no un desalojo).
// Corrige el caso real: la demanda de construcción activaba "monitorio de
// arrendamiento" (por "rentas de arrendamiento") y "multa de tránsito"
// (por la cláusula penal).

interface AccionRule {
  nombre: string;
  re: RegExp;
  /** átomos (prefijos sin tilde) que DEBEN aparecer en la oración del match
   *  o en sus adyacentes (alguno basta). Sin ellos el match es NEUTRO. */
  requiere?: string[];
  /** si alguno aparece en la MISMA oración del match, NO es esta acción. */
  veta?: string[];
}

const ACCIONES: AccionRule[] = [
  // ── Inconfundibles: la frase completa solo existe en esa acción ──────────
  { nombre: "nulidad del despido", re: /nulidad del despido|art\.?\s*162|162 inciso/gi },
  { nombre: "despido injustificado", re: /despido(?:\s+(?:injustificad|sin\s+caus)|\s*unilateral)|constituye causa/gi },
  { nombre: "cobro de cotizaciones previsionales", re: /cotizaciones\s+previsionales|cobro\s+previsional|fondos de compensaci[oó]n/gi },
  { nombre: "indemnización por años de servicio", re: /indemnizaci[oó]n por a[ñn]os de servicio|30\s+d[íi]as\s+de\s+la\s+(?:[úu]ltima\s+)?remuneraci/gi },
  { nombre: "fuero maternal", re: /fuero (?:maternal|paternal)|desafuero/gi },
  { nombre: "prácticas antisindicales", re: /pr[áa]cticas antisindicales/gi },
  { nombre: "mandamiento de ejecución y embargo", re: /mandamiento\s+de\s+ejecuci[oó]n|desp[aá]chese\s+mandamiento|ejecuci[oó]n\s+y\s+embargo/gi },
  { nombre: "nulidad de lo obrado", re: /nulidad\s+de\s+lo\s+obrado/gi },
  { nombre: "pensión de alimentos", re: /pensi[oó]n\s+de\s+alimentos|alimentos\s+provisorios/gi },
  { nombre: "indemnización de daño moral", re: /da[ñn]o moral|perjuicio moral/gi },
  { nombre: "Ley Karin", re: /karin|21\.?\s?643/gi },
  // ── Ambiguas: exigen vecinos en la oración ────────────────────────────────
  { nombre: "tutela de derechos fundamentales",
    re: /tutela|art\.?\s*48[56]/gi,
    requiere: ["laboral", "trabaj", "empleador", "remuner", "sueldo", "jornada", "sindicat", "485", "486"] },
  { nombre: "acoso laboral / hostigamiento (Ley Karin)",
    re: /acoso|hostigamiento/gi,
    requiere: ["laboral", "trabaj", "empleador", "jefe", "jefa", "oficina", "empresa", "supervisor", "coleg"],
    veta: ["escolar"] },
  { nombre: "responsabilidad subsidiaria contratista/mandante (art. 64 CT)",
    re: /contratistas?|subcontrat\w*|mandantes?|due[ñn]a de la obra/gi,
    requiere: ["trabajador", "trabajador", "sueldo", "remuneraci", "faena", "cotizaci", "inspecci"] },
  { nombre: "procedimiento monitorio de arrendamiento (Ley 18.101)",
    re: /monitorio|18\.?\s?101|restituci[oó]n del (?:inmueble|local)|desahuci[oó]\s+de\s+arrendamiento/gi,
    requiere: ["arrend", "inquilin", "renta"],
    veta: ["lucro", "no percibid", "perdid", "cesante"] },
  { nombre: "excepción de contrato no cumplido",
    re: /contrato\s+no\s+cumplido|exceptio\s+non\s+adimpleti/gi,
    requiere: ["contrat", "incumpl", "obligaci"] },
  { nombre: "recurso de apelación",
    re: /apelaci[oó]n|apelar/gi,
    requiere: ["sentenci", "resoluci[oó]n", "medida", "juzgado", "tribunal", "condena", "multa", "transit", "jpl", "corte"] },
  { nombre: "multa / infracción de tránsito (JPL)",
    re: /infracci[oó]n(?:es)?|multa|boleta\s+de\s+citaci/gi,
    requiere: ["transit", "jpl", "polic[ií]a local", "policia local", "licenc", "tag", "permiso de circulaci", "ebried", "alcohol", "veh[ií]cul", "conduc"] },
  { nombre: "desahucio / restitución por precario",
    re: /desahuci|desaloj|precario/gi,
    requiere: ["arriend", "arrend", "inquilin", "local", "viviend", "casa", "restituci"] },
  { nombre: "prescripción (defensa o excepción)",
    re: /prescripci/gi },
];

/** Oración con su rango en el texto crudo (para ubicar cada match). */
interface OracionCruda { desde: number; hasta: number; norm: string }

function partirTextoEnOraciones(texto: string): OracionCruda[] {
  const out: OracionCruda[] = [];
  const re = /[.!?\n;]+/g;
  let inicio = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const fin = m.index + m[0].length;
    if (fin > inicio) {
      const seg = texto.slice(inicio, fin);
      if (seg.trim()) out.push({ desde: inicio, hasta: fin, norm: quitarAcentos(seg).toLowerCase() });
    }
    inicio = fin;
  }
  if (inicio < texto.length) {
    const seg = texto.slice(inicio);
    if (seg.trim()) out.push({ desde: inicio, hasta: texto.length, norm: quitarAcentos(seg).toLowerCase() });
  }
  return out;
}

/** ¿La oración (ya normalizada) contiene el átomo como prefijo de palabra? */
function tieneAtomo(norm: string, atomo: string): boolean {
  try { return new RegExp(`\\b${atomo}`, "i").test(norm); }
  catch { return norm.includes(atomo); }
}

/** Evalúa las acciones con vecinos: cada match del patrón se confirma (o se
 *  descarta) mirando su oración y las adyacentes. Devuelve hasta 3 acciones
 *  confirmadas, ordenadas por matches confirmados. */
function detectarAcciones(texto: string): string[] {
  const oraciones = partirTextoEnOraciones(texto);
  if (!oraciones.length) return [];
  const idxOracion = (pos: number): number => {
    for (let i = 0; i < oraciones.length; i++) {
      if (pos >= oraciones[i].desde && pos < oraciones[i].hasta) return i;
    }
    return -1;
  };
  const resultados: Array<{ nombre: string; hits: number }> = [];
  for (const acc of ACCIONES) {
    const re = new RegExp(acc.re.source, "gi");
    let hits = 0;
    for (const mm of texto.matchAll(re)) {
      const i = idxOracion(mm.index ?? 0);
      if (i < 0) continue;
      // Ámbito de vecinos: la oración del match ± las adyacentes inmediatas.
      const ambito = [oraciones[i - 1], oraciones[i], oraciones[i + 1]]
        .filter(Boolean).map((o) => o!.norm).join(" ");
      const misma = oraciones[i].norm;
      if (acc.veta && acc.veta.some((v) => tieneAtomo(misma, v))) continue; // otro sentido
      if (acc.requiere && !acc.requiere.some((r) => tieneAtomo(ambito, r))) continue; // sin vecinos: neutro
      hits++;
    }
    if (hits > 0) resultados.push({ nombre: acc.nombre, hits });
  }
  return resultados.sort((a, b) => b.hits - a.hits).slice(0, 3).map((r) => r.nombre);
}

// Encabezados reales de escritos chilenos. El emparejamiento es sobre texto
// sin acentos y en mayusculas para tolerar ESCRITO/mixto.
const HECHOS_KW = ["Antecedentes de hecho", "LOS HECHOS", "HECHOS", "EN LO PRINCIPAL", "PRIMERO:", "SEGUNDO:", "VISTOS Y CONSIDERANDO"];
const DERECHO_KW = ["EL DERECHO", "FUNDAMENTOS DE DERECHO", "ESTUDIO JURIDICO", "EN Derecho", "Derecho:", "FUNDAMENTOS"];
const PETITORIO_KW = ["EN LO PETITORIO", "PETITORIO", "POR TANTO", "SOLICITO", "SOLICITA", "TENIENDO PRESENTE", "RESUELVE", "RESUELVA"];
// Marcadores de corte: encabezados de seccion (sin los ordinales PRIMERO/SEGUNDO,
// que viven DENTRO de los hechos y no deben cortarlos).
const ENCABEZADOS_POSIBLES = new Set(
  ["EN LO PRINCIPAL", "ANTECEDENTES DE HECHO", "LOS HECHOS", "EL DERECHO", "FUNDAMENTOS DE DERECHO",
   "ESTUDIO JURIDICO", "EN LO PETITORIO", "PETITORIO", "POR TANTO", "TENIENDO PRESENTE", "RESUELVE", "RESUELVA"]
    .map((k) => quitarAcentos(k.toUpperCase()))
);

function quitarAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function idxDe(textoNorm: string, kws: string[], primero: boolean): number {
  let idx = -1;
  for (const kw of kws) {
    const kwn = quitarAcentos(kw.toUpperCase());
    let i = textoNorm.indexOf(kwn);
    if (i === -1) continue;
    if (primero) { idx = i; break; }
    idx = Math.max(idx, i);
  }
  return idx;
}

const ART_RE = /(?:art[ií]culo|arts?\.?)\s*(\d{1,4})\s*[°º]?\s*(bis|ter|quater)?/gi;

export function extraerChileno(textoCrudo: string): ExtractoChileno {
  const vacio: ExtractoChileno = {
    secciones: { hechos: "", derecho: "", petitorio: "" },
    articulosInvocados: [],
    normasDetectadas: [],
    pares: [],
    montos: [],
    fechas: [],
    rut: [],
    juzgado: "",
    acciones: [],
    longitudEntrada: textoCrudo ? textoCrudo.length : 0,
  };
  const texto = typeof textoCrudo === "string" ? textoCrudo : "";
  if (texto.length < 40) return vacio;
  try {
    const norm = quitarAcentos(texto.toUpperCase());

    // ── Secciones ────────────────────────────────────────────────────────────
    const cortarHasta = (inicio: number, max: number): string => {
      if (inicio < 0) return "";
      const ventana = texto.slice(inicio, inicio + max);
      // Corta en el proximo encabezado conocido (si aparece mas alla de 120 chars)
      let corte = -1;
      for (const enc of ENCABEZADOS_POSIBLES) {
        let i = ventana.indexOf(enc, 10);
        if (i > 120 && (corte === -1 || i < corte)) corte = i;
      }
      const usable = cortesSanos(corte >= 0 ? ventana.slice(0, corte) : ventana);
      return usable;
    };
    const cortesSanos = (s: string): string => {
      // corta en el ultimo punto si el final no es blanco
      const t = s.trim();
      if (!t) return t;
      if (t.endsWith(".")) return t;
      const lastDot = Math.max(t.lastIndexOf(". "), t.lastIndexOf("; "), t.lastIndexOf(".\n"));
      return lastDot > t.length * 0.5 ? t.slice(0, lastDot + 1) : t;
    };

    const iHechos = idxDe(norm, HECHOS_KW, true);
    const iDerecho = idxDe(norm, DERECHO_KW, true);
    const iPetitorio = idxDe(norm, PETITORIO_KW, false);

    const secciones = {
      hechos: cortarHasta(iHechos, 5000),
      derecho: cortarHasta(iDerecho, 6000),
      petitorio: cortarHasta(iPetitorio, 2500),
    };

    // ── Normas invocadas ────────────────────────────────────────────────────
    const normasDetectadas: ExtractoChileno["normasDetectadas"] = [];
    for (const [key, def] of Object.entries(NORMAS)) {
      const m = texto.match(def.re);
      if (m) normasDetectadas.push({ key, nombre: def.nombre });
    }

    // ── Artículos invocados (pares por proximidad norma-articulo) ───────────
    const arts: Array<{ n: string; idx: number }> = [];
    ART_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = ART_RE.exec(texto)) !== null) {
      const antes = texto.slice(Math.max(0, am.index - 70), am.index).toLowerCase();
      const despues = texto.slice(am.index, am.index + 80).toLowerCase();
      if (/constituc/.test(antes) || /constituc/.test(despues)) continue;
      const sufijo = am[2] ? ` ${am[2].toLowerCase()}` : "";
      arts.push({ n: am[1] + sufijo, idx: am.index });
    }
    // Pares "norma k cerca del art j" (mismo enfoque de verificarCitasBCN job-agnostic)
    const pares: ParNormaArt[] = [];
    for (const [key, def] of Object.entries(NORMAS)) {
      const re = new RegExp(def.re.source, "gi");
      let na: RegExpExecArray | null;
      const idxs: number[] = [];
      while ((na = re.exec(texto)) !== null) idxs.push(na.index);
      for (const a of arts) {
        const cercana = idxs.filter((i) => i > a.idx && i - a.idx < 140)[0] ?? idxs.filter((i) => i < a.idx && a.idx - i < 400).sort((x, y) => y - x)[0];
        if (cercana) pares.push({ keyNorma: key, nombreNorma: def.nombre, articulo: a.n });
      }
    }
    const invocados = Array.from(new Set(arts.map((a) => a.n))).slice(0, 30);

    // ── Montos, fechas, RUT, juzgado ────────────────────────────────────────
    const reMonto = /(?:\$|CLP)\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?)|(\d{1,3}(?:\.\d{3})+)\s*(?:CLP|pesos)/gi;
    const montos: string[] = [];
    reMonto.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = reMonto.exec(texto)) !== null) {
      const v = mm[1] || mm[2];
      if (v) montos.push(v);
      if (montos.length >= 12) break;
    }
    const reFecha = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{2,4}\b/gi;
    const fechas: string[] = [];
    reFecha.lastIndex = 0;
    let fm: RegExpExecArray | null;
    while ((fm = reFecha.exec(texto)) !== null) {
      fechas.push(fm[0]);
      if (fechas.length >= 10) break;
    }
    const reRut = /\b(\d{1,2}\.\d{3}\.\d{3}-[0-9kK])\b/g;
    const rut: string[] = [];
    reRut.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = reRut.exec(texto)) !== null) {
      rut.push(rm[1]);
      if (rut.length >= 6) break;
    }
    const jzM = texto.match(/\b(?:S\.?J\.?L\.?\s+(?:del\s+)?(?:Trabajo|Laboral)[^,\n]{0,40}|Juzgado\s+(?:de\s+)?(?:Letras\s+)?(?:del\s+)?(?:Trabajo|Laboral|de\s+Letras[^,\n]{0,40}))/i);
    const juzgado = jzM ? jzM[0].trim().replace(/\s+/g, " ") : "";

    // ── Acciones detectadas (hasta 3, confirmadas por vecinos de oración) ──
    const acciones = detectarAcciones(texto);

    return {
      secciones,
      articulosInvocados: invocados,
      normasDetectadas,
      pares: pares.slice(0, 40),
      montos: montos,
      fechas: fechas,
      rut: rut,
      juzgado,
      acciones,
      longitudEntrada: texto.length,
    };
  } catch (e: any) {
    console.warn(`[extractor] fallo (devuelve vacio): ${String(e?.message || e).slice(0, 200)}`);
    return vacio;
  }
}

export function planoBlindajePrompt(ext: ExtractoChileno): string {
  if (ext.longitudEntrada === 0) return "";
  const lineas: string[] = [];
  lineas.push("\n\nPLANO DE LECTURA DETERMINISTA (extraido EN LOCAL, sin IA, del documento del caso):");
  for (const a of ext.acciones.slice(0, 3)) lineas.push(`- Accion detectada: ${a}`);
  if (ext.juzgado) lineas.push(`- Tribunal: ${ext.juzgado}`);
  for (const n of ext.normasDetectadas.slice(0, 6)) lineas.push(`- Cuerpo legal invocado: ${n.nombre}`);
  lineas.push(`- Articulos invocados: ${ext.articulosInvocados.slice(0, 25).join(", ") || "(ninguno detectado)"}`);
  if (ext.montos.length) lineas.push(`- Montos detectados (CLP): ${ext.montos.slice(0, 6).join(", ")}`);
  if (ext.fechas.length) lineas.push(`- Fechas detectadas: ${ext.fechas.slice(0, 6).join(", ")}`);
  if (ext.rut.length) lineas.push(`- RUT presentes: ${ext.rut.slice(0, 3).join(", ")}`);
  lineas.push(`(Toda cifra o monto en sectores del informe debe ser consistente con estos datos: si no lo esta, marcalo "no corroborado".)`);
  return lineas.join("\n") + "\n";
}
