// Guardián de la semilla normativa (NORMA_IDS + LEY_EXTRA) contra el XML
// oficial de Ley Chile. Por qué existe: un idNorma mal copiado inyecta el
// texto de OTRO cuerpo legal como "verdad normativa" en el prompt premium
// (así se descubrió que LEY_EXTRA guardaba el NÚMERO DE LEY en el campo
// idNorma: "Ley 18.916" descargaba un decreto de pensión por gracia ajeno).
// Verifica, para CADA entrada:
//   1) (offline) que su regex detecte la cita canónica y resuelva el idNorma
//      declarado; que "DFL N° 1"/"DFL N° 2" pelados NO caigan en CC/CT (con
//      denominador sí); que "Estatuto Administrativo Municipal" no se confunda
//      con el estatuto del art. 61; y que LEY_EXTRA resuelva por número.
//   2) (red) que el XML de ese idNorma traiga <TituloNorma>/<Tipo>/<Numero>
//      esperados y que el normaId del documento calce con el declarado.
// Falla (exit 1) si algo no calza: ninguna entrada entra o permanece en la
// semilla sin pasar este chequeo. Uso manual (una descarga por norma,
// cortesía con Ley Chile):
//   npx tsx scripts/qa-semilla-bcn.ts

import { NORMA_IDS, LEY_EXTRA, extraerCitadasPorNorma } from "../bcnLeyChile.js";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok + fail} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}

// ── expectativas por clave (contrastadas con el XML oficial, 2026-11-02) ────
interface Esperado { titulo: string; tipo?: string; numero?: string; cita: string; }
const ESPERADO: Record<string, Esperado> = {
  // códigos: el título manda; Tipo/Numero solo donde el XML lo trae estable
  CC: { titulo: "CODIGO CIVIL", cita: "Código Civil" },
  CP: { titulo: "CODIGO PENAL", cita: "Código Penal" },
  CT: { titulo: "CODIGO DEL TRABAJO", cita: "Código del Trabajo" },
  CPC: { titulo: "PROCEDIMIENTO CIVIL", cita: "Código de Procedimiento Civil" },
  CPP: { titulo: "CODIGO PROCESAL PENAL", cita: "Código Procesal Penal" },
  CCom: { titulo: "CODIGO DE COMERCIO", cita: "Código de Comercio" },
  CTrib: { titulo: "CODIGO TRIBUTARIO", tipo: "Decreto Ley", numero: "830", cita: "Código Tributario" },
  CAguas: { titulo: "CODIGO DE AGUAS", tipo: "Decreto con Fuerza de Ley", numero: "1122", cita: "Código de Aguas" },
  CSan: { titulo: "CODIGO SANITARIO", tipo: "Decreto con Fuerza de Ley", numero: "725", cita: "Código Sanitario" },
  CMiner: { titulo: "CODIGO DE MINERIA", tipo: "Ley", numero: "18248", cita: "Código de Minería" },
  CJM: { titulo: "CODIGO DE JUSTICIA MILITAR", tipo: "Decreto", numero: "2226", cita: "Código de Justicia Militar" },
  CAero: { titulo: "CODIGO AERONAUTICO", tipo: "Ley", numero: "18916", cita: "Código Aeronáutico" },
  LGUC: { titulo: "URBANISMO", tipo: "Decreto", numero: "458", cita: "Ley General de Urbanismo y Construcciones" },
  // leyes especiales
  // 14.908 refunde la Ley 5.750 (Ley de Menores): el título oficial dice
  // "REFUNDIDO DE LA LEY NUMERO 5.750", no "alimenticia". La identidad la
  // fijan tipo=Ley + numero=14908.
  L14908: { titulo: "LEY NUMERO 5.750", tipo: "Ley", numero: "14908", cita: "Ley 14.908" },
  L16744: { titulo: "ACCIDENTES DEL TRABAJO", tipo: "Ley", numero: "16744", cita: "Ley 16.744" },
  L17336: { titulo: "PROPIEDAD INTELECTUAL", tipo: "Ley", numero: "17336", cita: "Ley 17.336" },
  L18046: { titulo: "SOCIEDADES ANONIMAS", tipo: "Ley", numero: "18046", cita: "Ley 18.046" },
  L18101: { titulo: "ARRENDAMIENTO", tipo: "Ley", numero: "18101", cita: "Ley 18.101" },
  L18216: { titulo: "SUSTITUTIVAS", tipo: "Ley", numero: "18216", cita: "Ley 18.216" },
  L18287: { titulo: "POLICIA LOCAL", tipo: "Ley", numero: "18287", cita: "Ley 18.287" },
  L18290: { titulo: "TRANSITO", tipo: "Ley", numero: "18290", cita: "Ley 18.290" },
  L18314: { titulo: "TERRORIS", tipo: "Ley", numero: "18314", cita: "Ley 18.314" },
  L18575: { titulo: "BASES GENERALES DE LA ADMINISTRACION", tipo: "Ley", numero: "18575", cita: "Ley 18.575" },
  L18695: { titulo: "MUNICIPALIDADES", tipo: "Ley", numero: "18695", cita: "Ley 18.695" },
  L18834: { titulo: "ESTATUTO ADMINISTRATIVO", tipo: "Ley", numero: "18834", cita: "Estatuto Administrativo" },
  L18883: { titulo: "FUNCIONARIOS MUNICIPALES", tipo: "Ley", numero: "18883", cita: "Estatuto Administrativo Municipal" },
  L19039: { titulo: "INDUSTRIALES", tipo: "Ley", numero: "19039", cita: "Ley 19.039" },
  L19300: { titulo: "MEDIO AMBIENTE", tipo: "Ley", numero: "19300", cita: "Ley 19.300" },
  L19496: { titulo: "CONSUMIDORES", tipo: "Ley", numero: "19496", cita: "Ley del Consumidor" },
  L19628: { titulo: "VIDA PRIVADA", tipo: "Ley", numero: "19628", cita: "Ley 19.628" },
  L19880: { titulo: "PROCEDIMIENTOS ADMINISTRATIVOS", tipo: "Ley", numero: "19880", cita: "Ley 19.880" },
  L19886: { titulo: "CONTRATOS ADMINISTRATIVOS", tipo: "Ley", numero: "19886", cita: "Ley 19.886" },
  L19947: { titulo: "MATRIMONIO CIVIL", tipo: "Ley", numero: "19947", cita: "Ley 19.947" },
  L19968: { titulo: "FAMILIA", tipo: "Ley", numero: "19968", cita: "Ley 19.968" },
  L20000: { titulo: "ESTUPEFACIENTES", tipo: "Ley", numero: "20000", cita: "Ley 20.000" },
  L20009: { titulo: "TARJETAS DE PAGO", tipo: "Ley", numero: "20009", cita: "Ley 20.009" },
  L20066: { titulo: "VIOLENCIA INTRAFAMILIAR", tipo: "Ley", numero: "20066", cita: "Ley 20.066" },
  L20084: { titulo: "ADOLESCENTES", tipo: "Ley", numero: "20084", cita: "Ley 20.084" },
  L20720: { titulo: "REORGANIZACION", tipo: "Ley", numero: "20720", cita: "Ley 20.720" },
  L21325: { titulo: "MIGRACION", tipo: "Ley", numero: "21325", cita: "Ley 21.325" },
  L21430: { titulo: "GARANTIAS", tipo: "Ley", numero: "21430", cita: "Ley 21.430" },
  L21561: { titulo: "JORNADA", tipo: "Ley", numero: "21561", cita: "Ley 21.561" },
  L21643: { titulo: "ACOSO", tipo: "Ley", numero: "21643", cita: "Ley Karin" },
  L21719: { titulo: "DATOS PERSONALES", tipo: "Ley", numero: "21719", cita: "Ley 21.719" },
};

// ── 1) detección offline (sin red) ───────────────────────────────────────────
for (const [key, esp] of Object.entries(ESPERADO)) {
  const def = NORMA_IDS[key];
  if (!def) { chk(`${key} existe en NORMA_IDS`, false, "falta la entrada"); continue; }
  const r = extraerCitadasPorNorma(`Conforme a ${esp.cita}, el art. 5 dispone.`);
  const hit = r.normas.find((n) => n.key === key);
  chk(`${key} detecta "${esp.cita}" -> idNorma ${def.id}`,
    !!hit && hit.resuelta && hit.idNorma === def.id, r.normas);
}

// hardening DFL: "DFL N° 1"/"DFL N° 2" pelados NO resuelven CC/CT (antes
// cualquier DFL 1 o DFL 2 del mundo caía ahí); con denominador sí.
const dfl1 = extraerCitadasPorNorma("Conforme al DFL N° 1 de otro ministerio, art. 5.");
chk("negativo: 'DFL N° 1' pelado NO resuelve CC", !dfl1.normas.some((n) => n.key === "CC"), dfl1.normas);
const dfl2 = extraerCitadasPorNorma("Conforme al DFL N° 2 de otro ministerio, art. 5.");
chk("negativo: 'DFL N° 2' pelado NO resuelve CT", !dfl2.normas.some((n) => n.key === "CT"), dfl2.normas);
const dfl1b = extraerCitadasPorNorma("Conforme al DFL 1/2000, art. 5.");
chk("positivo: 'DFL 1/2000' resuelve CC", dfl1b.normas.some((n) => n.key === "CC" && n.resuelta), dfl1b.normas);
const dfl2b = extraerCitadasPorNorma("Conforme al DFL 2 de 2003, art. 5.");
chk("positivo: 'DFL 2 de 2003' resuelve CT", dfl2b.normas.some((n) => n.key === "CT" && n.resuelta), dfl2b.normas);

// estatutos no se pisan
const eadm = extraerCitadasPorNorma("El Estatuto Administrativo Municipal, art. 5.");
chk("negativo: 'Estatuto Administrativo Municipal' NO resuelve L18834", !eadm.normas.some((n) => n.key === "L18834"), eadm.normas);
chk("positivo: 'Estatuto Administrativo Municipal' resuelve L18883", eadm.normas.some((n) => n.key === "L18883" && n.resuelta), eadm.normas);

// LEY_EXTRA por número: idNorma CORRECTO (no el número de ley — bug corregido)
const aer = extraerCitadasPorNorma("Conforme a la Ley 18.916, art. 5.");
const aerHit = aer.normas.find((n) => n.key === "LEY18916");
chk("LEY_EXTRA: 'Ley 18.916' -> idNorma 30287 (Aeronáutico)", !!aerHit && aerHit.resuelta && aerHit.idNorma === 30287, aer.normas);
const min = extraerCitadasPorNorma("Conforme a la Ley 18.248, art. 5.");
const minHit = min.normas.find((n) => n.key === "LEY18248");
chk("LEY_EXTRA: 'Ley 18.248' -> idNorma 29668 (Minería)", !!minHit && minHit.resuelta && minHit.idNorma === 29668, min.normas);
chk("LEY_EXTRA: 'Ley 8.274' ya NO resuelve por número (etiqueta falsa eliminada)",
  (() => { const r = extraerCitadasPorNorma("Conforme a la Ley 8.274, art. 5."); const h = r.normas.find((n) => n.key === "LEY8274"); return !h || !h.resuelta; })());

// ── 2) verificación en red contra el XML oficial ─────────────────────────────
function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function normalizar(s: string): string {
  return decodificar(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
async function fetchNorma(id: number): Promise<string> {
  const res = await fetch(`https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${id}`, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (qa semilla; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  return await res.text();
}

console.log("\nVerificación en red (una descarga por norma, pausa de cortesía)...");
for (const [key, esp] of Object.entries(ESPERADO)) {
  const def = NORMA_IDS[key];
  if (!def) continue;
  try {
    const xml = await fetchNorma(def.id);
    const tipo = decodificar((xml.match(/<Tipo>\s*([^<]+?)\s*<\/Tipo>/) || ["", ""])[1]).trim();
    const numero = (xml.match(/<Numero>\s*(\d+)\s*<\/Numero>/) || ["", ""])[1];
    const tituloM = xml.match(/<TituloNorma[^>]*>([\s\S]{0,400}?)<\/TituloNorma>/);
    const titulo = normalizar(tituloM ? tituloM[1] : "");
    const niM = xml.match(/normaId="(\d+)"/);
    const problemas: string[] = [];
    if (!titulo.includes(esp.titulo)) problemas.push(`titulo "${titulo.slice(0, 90)}" no contiene "${esp.titulo}"`);
    if (esp.tipo && !tipo.toLowerCase().startsWith(esp.tipo.toLowerCase())) problemas.push(`tipo "${tipo}" != "${esp.tipo}"`);
    if (esp.numero && numero !== esp.numero) problemas.push(`numero "${numero}" != "${esp.numero}"`);
    if (niM && niM[1] !== String(def.id)) problemas.push(`normaId del XML (${niM[1]}) != declarado (${def.id})`);
    chk(`RED ${key} (idNorma ${def.id}) calza con XML oficial`, problemas.length === 0, problemas.join("; "));
  } catch (e: any) {
    chk(`RED ${key} (idNorma ${def.id})`, false, String(e?.message || e));
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\nQA SEMILLA BCN: ${ok} pass, ${fail} fail (${Object.keys(ESPERADO).length} normas + negativos offline)`);
if (fail > 0) process.exit(1);
