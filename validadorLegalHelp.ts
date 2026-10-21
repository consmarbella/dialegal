// Validador extendido para LegalHelp IA (Motor de Redacción Procesal)
// Basado en validadorInforme.ts pero con validaciones específicas de estructura judicial
// MODULAR: no toca validadorInforme.ts ni el endpoint premium-report

import type { ValidacionInformeUI, BcnArticuloCitado } from "./src/types";

export interface ValidacionLegalHelp extends ValidacionInformeUI {
  rolesInforme: string[];
  artsInforme: string[];
  estructuraJudicial: boolean;
  articulosClaveFaltantes: string[];
  petitorioValido: boolean;
  numeracionHechosValida: boolean;
}

export interface InsumosValidacionLegalHelp {
  rolesCorpus: string[];
  artsCubiertos: string[];
  artsPendientes: string[];
  montosDoc: string[];
  textoDoc: string;
  area: "laboral" | "civil" | "familia" | "penal" | "administrativo" | "constitucional";
  tipo: "demanda" | "contestacion" | "otrosi" | "minuta" | "contrato" | "correo";
}

const ARTICULOS_CLAVE_POR_AREA: Record<string, string[]> = {
  laboral: ["159", "161", "162", "174", "201", "452", "485", "489"],
  civil: ["1445", "1545", "1547", "1554", "1559", "2314", "2320"],
  familia: ["229", "230", "232", "233", "439", "440", "441"],
  penal: ["1", "2", "12", "13", "14", "15", "16", "17"],
  administrativo: ["5", "6", "7", "8", "9", "10", "11", "12"],
  constitucional: ["1", "2", "3", "4", "5", "19", "20", "21"],
};

function normalizarRol(s: string): string {
  return s
    .toLowerCase()
    .replace(/^rol\s*n?[°º]?\s*:?\s*/, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .replace(/°|º/g, "")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function baseDeRol(r: string): string {
  return normalizarRol(r).split(/[-–]/)[0];
}

const ROLES_RE = /\brol(?:\s*n?[°º]|\s*n?o|\s*numero|\s*nro)?\s*\.?\s*:?\s*([0-9][0-9 .,]{2,14}[0-9])(?:\s*[-–]\s*([0-9]{2,4}|[0-9]{1,2}[A-Za-z](?:-[A-Za-z]{2,6})?|[A-Za-z]{2,6}))?/gi;
const ARTS_RE = /art(?:[íi]culos?|[íi]culo|\.)?\s*n?[°º]?\s*([0-9]{1,4})/gi;
const MONTOS_RE = /(?:\$|CLP)[\s]*(\d{1,3}(?:\.\d{3})+(?:,\d+)?)|(\d{1,3}(?:\.\d{3})+)\s*(?:CLP|pesos)/gi;

const ESTRUCTURA_DEMANDA = [
  /S\.J\.L\.|Juzgado\s+(?:de\s+)?(?:Letras\s+)?(?:del\s+)?(?:Trabajo|Laboral|de\s+Letras)/i,
  /EN\s+LO\s+PRINCIPAL|DEMANDA\s+DE/i,
  /PRIMERO:|SEGUNDO:|TERCERO:|ANTECEDENTES\s+DE\s+HECHO/i,
  /FUNDAMENTOS\s+DE\s+DERECHO|EL\s+DERECHO/i,
  /PETITORIO|POR\s+TANTO|SOLICITO/i,
];

const ESTRUCTURA_CONTESTACION = [
  /S\.J\.L\.|Juzgado/i,
  /CONTESTACI[OÓ]N\s+DE\s+DEMANDA|CONTESTAR\s+(?:LA\s+)?DEMANDA|CONTESTAR\b/i,
  /EXCEPCIONES?\s+PREVIAS|EXCEPCI[OÓ]N[^\n]{0,80}|DEFENSA\s+PREVIA/i,
  /NEGATIVA\s+DE\s+HECHOS|HECHOS\s+(?:NEGADOS|ADMITIDOS)|NEGATIVA[^\n]{0,60}HECHOS|NEGO\s+(?:CATEG[OÓ]RICAMENTE\s+)?(?:Y\s+)?CONTROVIERTO|CONTROVERTIENDO\s+EXPRESAMENTE/i,
  /DEFENSAS?\s+DE\s+FONDO|FUNDAMENTOS?\s+DE\s+DERECHO|EL\s+DERECHO/i,
  /PETITORIO|SOLICITO|POR\s+TANTO|A\s+U\.?\s?S\.?\s+PIDO/,
];

const ESTRUCTURA_OTROSI = [
  /S\.J\.L\.|Juzgado/i,
  /OTROS[ÍI]\s*:/i,
  /FUNDAMENTO\s+(?:LEGAL|JUR[ÍI]DICO)/i,
  /SOLICITO|PETITORIO/i,
];

const ESTRUCTURA_MINUTA = [
  /MINUTA\s+DE/i,
  /HECHOS\s+RELEVANTES|ANTECEDENTES/i,
  /ARGUMENTOS\s+ORALES|PETICIONES/i,
];

function validarEstructuraJudicial(texto: string, tipo: string): boolean {
  const estructuras: Record<string, RegExp[]> = {
    demanda: ESTRUCTURA_DEMANDA,
    contestacion: ESTRUCTURA_CONTESTACION,
    otrosi: ESTRUCTURA_OTROSI,
    minuta: ESTRUCTURA_MINUTA,
  };
  const patrones = estructuras[tipo] || ESTRUCTURA_DEMANDA;
  return patrones.every((re) => re.test(texto));
}

function validarNumeracionHechos(texto: string): boolean {
  const ordinales = ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO"];
  const encontrados = ordinales.filter((o) => new RegExp(`\\b${o}\\b`, "i").test(texto));
  if (encontrados.length === 0) return false;
  for (let i = 0; i < encontrados.length - 1; i++) {
    const idx1 = ordinales.indexOf(encontrados[i]);
    const idx2 = ordinales.indexOf(encontrados[i + 1]);
    if (idx2 - idx1 > 1) return false;
  }
  return true;
}

function validarPetitorio(texto: string): boolean {
  const petSection = texto.split(/PETITORIO|POR\s+TANTO|SOLICITO|EN\s+M[ÉE]RITO|\bPIDO\b/i)[1] || "";
  if (!petSection) return false;
  const items =
    petSection.match(/^\s*(?:[0-9]+[.)]\s*|[-•]\s*|[A-ZÁÉÍÓÚ][.,)]\s+|PRIMERO\b|SEGUNDO\b|TERCERO\b|CUARTO\b|QUINTO\b)/gm) || [];
  return items.length >= 2;
}

export function validarLegalHelp(report: string, insumos: InsumosValidacionLegalHelp): ValidacionLegalHelp {
  const base: ValidacionLegalHelp = {
    rolesInforme: [], rolesEnCorpus: [], rolesNoEnCorpus: [],
    artsInforme: [], artsCubiertos: [], artsSinCobertura: [],
    montosInforme: 0, montosNoCorroborados: [],
    estructuraJudicial: false,
    articulosClaveFaltantes: [],
    petitorioValido: false,
    numeracionHechosValida: false,
  };
  const texto = typeof report === "string" ? report : "";
  if (!texto) return base;

  try {
    const rolesCorpusSet = new Set(insumos.rolesCorpus.map(normalizarRol).filter(Boolean));
    const rolesCorpusBaseSet = new Set(insumos.rolesCorpus.map(baseDeRol).filter(Boolean));
    const artsCubiertosSet = new Set(insumos.artsCubiertos.map((x) => String(x).replace(/\s+/g, "")));

    ROLES_RE.lastIndex = 0;
    const rolesInforme: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROLES_RE.exec(texto)) !== null) {
      const sufijo = m[2] ? `-${m[2].toLowerCase()}` : "";
      const bruto = normalizarRol(m[1]) + sufijo;
      if (/^\d{4}$/.test(bruto)) continue;
      if (!rolesInforme.includes(bruto)) rolesInforme.push(bruto);
      if (rolesInforme.length >= 20) break;
    }

    ARTS_RE.lastIndex = 0;
    const artsInforme: string[] = [];
    while ((m = ARTS_RE.exec(texto)) !== null) {
      if (!artsInforme.includes(m[1])) artsInforme.push(m[1]);
      if (artsInforme.length >= 30) break;
    }

    MONTOS_RE.lastIndex = 0;
    const montosInforme: string[] = [];
    while ((m = MONTOS_RE.exec(texto)) !== null) {
      const v = m[1] || m[2];
      if (v && !montosInforme.includes(v)) montosInforme.push(v);
      if (montosInforme.length >= 12) break;
    }

    const textoDocClean = (insumos.textoDoc || "").replace(/[. \n]/g, "");

    const rolesEnCorpus = rolesInforme.filter((r) => rolesCorpusSet.has(r) || rolesCorpusBaseSet.has(baseDeRol(r)));
    const rolesNoEnCorpus = rolesInforme.filter((r) => !rolesCorpusSet.has(r));
    const artsCubiertos = artsInforme.filter((a) => artsCubiertosSet.has(a));
    const artsSinCobertura = artsInforme.filter((a) => !artsCubiertosSet.has(a));

    const montosNoCorroborados = montosInforme.filter((mo) => {
      if (insumos.montosDoc.includes(mo)) return false;
      const digitos = mo.replace(/\./g, "");
      return !textoDocClean.includes(digitos) && !insumos.textoDoc.includes(mo);
    });

    const clave = ARTICULOS_CLAVE_POR_AREA[insumos.area] || [];
    const articulosClaveFaltantes = clave.filter((a) => !artsCubiertos.includes(a) && !artsInforme.includes(a));

    const estructuraJudicial = validarEstructuraJudicial(texto, insumos.tipo);
    const numeracionHechosValida = validarNumeracionHechos(texto);
    const petitorioValido = validarPetitorio(texto);

    return {
      rolesInforme,
      rolesEnCorpus,
      rolesNoEnCorpus,
      artsInforme,
      artsCubiertos,
      artsSinCobertura,
      montosInforme: montosInforme.length,
      montosNoCorroborados,
      estructuraJudicial,
      articulosClaveFaltantes,
      petitorioValido,
      numeracionHechosValida,
    };
  } catch {
    return base;
  }
}

export function notaBlindajeLegalHelp(v: ValidacionLegalHelp): string {
  if (!v.rolesInforme.length && !v.artsInforme.length && v.estructuraJudicial) return "";
  const lineas: string[] = [];
  lineas.push("\n## 5. Trazabilidad Automática del Escrito");
  lineas.push("(QA determinista hecho EN LOCAL, sobre este texto ya generado. Lo que está marcado NO VERIFICADO debe confirmarse en las fuentes antes de usar el escrito.)\n");

  lineas.push(`- Estructura judicial (${v.estructuraJudicial ? "✅ COMPLETA" : "⚠️ INCOMPLETA"}) · Numeración hechos: ${v.numeracionHechosValida ? "✅" : "⚠️"} · Petitorio válido: ${v.petitorioValido ? "✅" : "⚠️"}`);

  lineas.push(`- Roles citados: ${v.rolesInforme.length} · en corpus: **${v.rolesEnCorpus.length}** · fuera: **${v.rolesNoEnCorpus.length}**`);
  for (const r of v.rolesNoEnCorpus.slice(0, 6)) {
    lineas.push(`  - ⚠️ Rol ${r} — NO VERIFICADO: no se encuentra en el corpus. Confírmalo en el buscador del PJUD antes de citarlo.`);
  }

  lineas.push(`- Artículos citados: ${v.artsInforme.length} · con texto BCN: **${v.artsCubiertos.length}** · sin cobertura: ${v.artsSinCobertura.length}`);
  for (const a of v.artsSinCobertura.slice(0, 6)) {
    lineas.push(`  - ⚠️ Art. ${a} — sin texto oficial en el canal BCN. Verifícalo en www.leychile.cl.`);
  }

  if (v.articulosClaveFaltantes.length > 0) {
    lineas.push(`- ⚠️ Artículos clave del área ${v.articulosClaveFaltantes.join(", ")} no detectados en el escrito. Considera incluirlos si son aplicables.`);
  }

  if (v.montosInforme > 0) {
    lineas.push(`- Montos: ${v.montosInforme} citados · corroborados: **${v.montosInforme - v.montosNoCorroborados.length}** · no hallados: ${v.montosNoCorroborados.length}`);
    for (const mo of v.montosNoCorroborados.slice(0, 4)) {
      lineas.push(`  - ⚠️ Monto $${mo} — no corroborado contra el documento. Revisa el cálculo.`);
    }
  }

  lineas.push("\n_Este contraste se hace con las mismas fuentes del motor (corpus Open Legal + Ley Chile BCN); su fin es ayudarte a detectar cualquier error del modelo, no reemplaza tu criterio profesional._");
  return lineas.join("\n");
}