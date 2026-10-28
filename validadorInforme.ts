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

/** Calibración gate (eval): extrae roles como lo hace validarInforme sobre el
 *  documento fuente. Misma regex + normalización que producción. */
export function extraerRolesDeTexto(texto: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  ROLES_RE.lastIndex = 0;
  while ((m = ROLES_RE.exec(texto || "")) !== null) {
    const bruto = normalizarRol(m[1]) + (m[2] ? `-${m[2].toLowerCase()}` : "");
    if (/^\d{4}$/.test(bruto)) continue;
    if (!out.includes(bruto)) out.push(bruto);
    if (out.length >= 20) break;
  }
  return out;
}

/** Igual para montos (formatos de producción). */
export function extraerMontosDeTexto(texto: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  MONTOS_RE.lastIndex = 0;
  while ((m = MONTOS_RE.exec(texto || "")) !== null) {
    const v = m[1] || m[2];
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= 12) break;
  }
  return out;
}

/** Números de artículos citados en texto (proxy BCN de calibración:
 *  en producción artsCubiertos viene del canal BCN; el evaluador usa los
 *  artículos presentes en el documento fuente como cobertura declarada). */
export function extraerArtsDeTexto(texto: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  ARTS_RE.lastIndex = 0;
  while ((m = ARTS_RE.exec(texto || "")) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
    if (out.length >= 30) break;
  }
  return out;
}

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
    // Fase 1: complemento exacto de rolesEnCorpus. Antes usaba comparación de
    // set exacto: un rol que coincidió solo por su base quedaba contado en los
    // dos buckets (doble conteo en correcciones).
    const rolesNoEnCorpus = rolesInforme.filter((r) => !rolesEnCorpus.includes(r));
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

// ── Fase 7 (B+C híbrido): GATE de errores estructurales graves ─────────────
// Solo para /api/premium-report (decisión DECISIONES: el borrador gratuito
// sigue como anotación por conversión). Estrategia de falsos positivos:
// se bloquea SOLO lo que es factualmente verificable por código; las señales
// probabilísticas (rol no en corpus pero posiblemente verificado por la web,
// monto calculado por el sistema, art. pendiente por flakiness BCN) siguen
// siendo ANOTACIÓN, nunca gate.
const RIT_RUC_RE = /\bR(?:IT|UC)\b[^0-9A-Za-z]{0,3}[:\)\s-]*([A-Z]?-?[\d.\-]{5,18})/gi; // RIT/RUC</think><tool_call>edit<arg_key>newString</arg_key><arg_value>const RIT_RUC_RE = /\bR(?:IT|UC)\b[^0-9A-Za-z]{0,3}[:\)\s-]*([A-Z]?-?[\d.\-]{5,18})/gi; // RIT/RUC

export function hallazgosBloqueantes(v: ValidacionInforme, report: string, textoDoc: string): string[] {
  const out: string[] = [];
  const texto = typeof report === "string" ? report : "";

  // 1) Marcadores "XX" crudos en el informe (hueco sin resolver visible).
  if (/(^|[^A-Za-záéíóúÁÉÍÓÚ])XX([^A-Za-záéíóúÁÉÍÓÚ]|$)/m.test(texto)) {
    out.push("institucion_hueco_XX: el informe contiene marcadores crudos 'XX' (la regla del motor es [DATO FALTANTE: ...]).");
  }

  // 2) RIT/RUC del encabezado que NO aparece en ninguna fuente del caso
  //    (documento/dictamen/relato): ese numero no nacio de parte del motor.
  const encabezado = texto.slice(0, 500);
  const docClean = (textoDoc || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  let m: RegExpExecArray | null;
  RIT_RUC_RE.lastIndex = 0;
  while ((m = RIT_RUC_RE.exec(encabezado)) !== null) {
    const num = (m[1] || "").replace(/[^0-9]/g, "");
    if (num.length >= 4 && !docClean.includes(num)) {
      out.push(`encabezado_rit_ruc_fuente_desconocida: "RIT/RUC ${m[1]}" del encabezado no aparece en el documento/dictamen del caso (riesgo: rol heredado de la contraparte o inventado).`);
      break; // con un solo caso grave bloquea
    }
  }
  return out;
}

// Apendice Markdown con la nota de trazabilidad automatica (se agrega al final
// del informe antes de devolverlo al abogado).
export function notaBlindajeReporte(v: ValidacionInforme): string {  if (!v.rolesInforme.length && !v.artsInforme.length) return "";
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
