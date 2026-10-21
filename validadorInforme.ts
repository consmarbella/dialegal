// Validador determinista post-salida (QA de la capa premium): escanea el informe
// ya redactado y contrasta cada Rol, Art. y monto contra el corpus local y el
// resultado BCN. Sin IA: si un "Rol N°" no existe en el corpus, no llega al
// abogado como hecho; queda marcado. Nunca arroja.

export interface ValidacionInforme {
  rolesInforme: string[];
  rolesEnCorpus: string[];
  rolesNoEnCorpus: string[];
  artsInforme: string[];
  artsCubiertos: string[];
  artsSinCobertura: string[];
  montosInforme: string[];
  montosNoCorroborados: string[];
  correcciones: number;
}

export interface InsumosValidacion {
  rolesCorpus: string[];            // roles de los insumos entregados al modelo
  artsCubiertos: string[];          // articulos con texto BCN verificado (num)
  artsPendientes: string[];         // articulos pedidos a BCN pero sin texto ( cuenta como cubierto-parcial )
  montosDoc: string[];              // montos extraidos del documento por el extractor
  textoDoc: string;                 // raw, para corroborar montos con otros formatos
}

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

export function validarInforme(report: string, insumos: InsumosValidacion): ValidacionInforme {
  const base: ValidacionInforme = {
    rolesInforme: [], rolesEnCorpus: [], rolesNoEnCorpus: [],
    artsInforme: [], artsCubiertos: [], artsSinCobertura: [],
    montosInforme: [], montosNoCorroborados: [], correcciones: 0,
  };
  const texto = typeof report === "string" ? report : "";
  if (!texto) return base;
  try {
    const rolesCorpusSet = new Set(insumos.rolesCorpus.map(normalizarRol).filter(Boolean));
    const rolesCorpusBaseSet = new Set(insumos.rolesCorpus.map(baseDeRol).filter(Boolean));

    ROLES_RE.lastIndex = 0;
    const rolesInforme: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ROLES_RE.exec(texto)) !== null) {
      const sufijo = m[2] ? `-${m[2].toLowerCase()}` : "";
      const bruto = normalizarRol(m[1]) + sufijo;
      // descarta anos sueltos como "rol 2026" (4 digitos sin sufijo)
      if (/^\d{4}$/.test(bruto)) continue;
      if (!rolesInforme.includes(bruto)) rolesInforme.push(bruto);
      if (rolesInforme.length >= 20) break;
    }

    const artsCubiertosSet = new Set(insumos.artsCubiertos.map((x) => String(x).replace(/\s+/g, "")));

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
    const textoDoc = insumos.textoDoc || "";
    const textoDocClean = textoDoc.replace(/[. \n]/g, "");

    const rolesEnCorpus = rolesInforme.filter((r) => rolesCorpusSet.has(r) || rolesCorpusBaseSet.has(baseDeRol(r)));
    const rolesNoEnCorpus = rolesInforme.filter((r) => !rolesCorpusSet.has(r));
    const artsCubiertos = artsInforme.filter((a) => artsCubiertosSet.has(a));
    const artsSinCobertura = artsInforme.filter((a) => !artsCubiertosSet.has(a));
    const montosNoCorroborados = montosInforme.filter((mo) => {
      if (insumos.montosDoc.includes(mo)) return false;
      // corroboracion por coeficiente: digitos sin separadores en el doc
      const digitos = mo.replace(/\./g, "");
      return !textoDocClean.includes(digitos) && !textoDoc.includes(mo);
    });

    return {
      rolesInforme,
      rolesEnCorpus,
      rolesNoEnCorpus,
      artsInforme,
      artsCubiertos,
      artsSinCobertura,
      montosInforme,
      montosNoCorroborados,
      correcciones: rolesNoEnCorpus.length + montosNoCorroborados.length,
    };
  } catch {
    return base;
  }
}

// Apendice Markdown con la nota de trazabilidad automatica (se agrega al final
// del informe antes de devolverlo al abogado).
export function notaBlindajeReporte(v: ValidacionInforme): string {
  if (!v.rolesInforme.length && !v.artsInforme.length) return "";
  const lineas: string[] = [];
  lineas.push("\n## 5. Trazabilidad Automática del Informe");
  lineas.push("(QA determinista hecho EN LOCAL, sobre este texto ya generado. Lo que está marcado NO VERIFICADO debe confirmarse en las fuentes antes de usar el informe.)\n");
  lineas.push(`- Roles citados en el informe: ${v.rolesInforme.length} · en el corpus verificado: **${v.rolesEnCorpus.length}** · fuera del corpus: **${v.rolesNoEnCorpus.length}**`);
  for (const r of v.rolesNoEnCorpus.slice(0, 6)) {
    lineas.push(`  - ⚠️ Rol ${r} — NO VERIFICADO: no se encuentra en el corpus entregado al modelo. Confírmalo en el buscador del PJUD antes de citarlo.`);
  }
  lineas.push(`- Artículos citados: ${v.artsInforme.length} · con verificación BCN: **${v.artsCubiertos.length}** · sin cobertura BCN en el canal: ${v.artsSinCobertura.length}`);
  for (const a of v.artsSinCobertura.slice(0, 6)) {
    lineas.push(`  - ⚠️ Art. ${a} — sin texto oficial en el canal BCN de este informe. Verifícalo directamente en www.leychile.cl.`);
  }
  if (v.montosInforme.length > 0) {
    lineas.push(`- Montos citados: ${v.montosInforme.length} · corroborados con el documento: **${v.montosInforme.length - v.montosNoCorroborados.length}** · no hallados: ${v.montosNoCorroborados.length}`);
    for (const mo of v.montosNoCorroborados.slice(0, 4)) {
      lineas.push(`  - ⚠️ Monto $${mo} — no corroborado contra el documento. Puede ser cálculo del sistema: revísalo.`);
    }
  }
  lineas.push("\n_Este contraste se hace con las mismas fuentes del motor (corpus Open Legal + Ley Chile BCN); su fin es ayudarte a detectar cualquier error del modelo, no reemplaza tu criterio profesional._");
  return lineas.join("\n");
}
