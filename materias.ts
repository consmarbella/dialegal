// materias.ts — Fase D: registro único de materias legales (fuente de verdad).
//
// Decisiones del dueño que este módulo materializa:
// 1. EL ÁREA DECLARADA MANDA: las señales del texto solo SUGIEREN. Si el texto
//    menciona "tutela laboral" en un caso declarado civil, el caso se queda en
//    civil con una anotación visible (nunca bloqueo) de conflicto.
// 2. SIN DEFAULT "LABORAL": si no hay señal, la materia es indeterminada
//    (null). Antes area-detector.ts:112/:136 devolvían "laboral" en empate o
//    cero señal — causa raíz de la contaminación civil→laboral del informe
//    premium real (Fase A, hallazgos.md §materia mixta).
// 3. La confianza es el MARGEN determinista entre scores (conteos crudos de
//    señales), no una probabilidad inventada.
// 4. Las materias sin plazos modelados declaran plazos: [] y el pipeline dice
//    "sin plazos modelados — [VERIFICAR]" en vez de inventar.
// 5. "transversal" NO es una materia: es la capa de fallback del corpus
//    (fichas Judicial/Procesal/General del dataset), siempre etiquetada.
//
// tránsito (decisión del dueño: 7 corpus + tránsito): sin corpus propio todavía
// (verificado 2026-10-29: el dataset de Open Legal Chile no trae área
// Tránsito; solo ~1 ficha relevante vive en civil.json). Su recuperación corre
// sobre normas BCN (L18290/L18287 ya en NORMA_IDS) + capa transversal
// etiquetada. Corpus propio = Fase H solo con fuente real.

export type SlugMateria =
  | "civil"
  | "laboral"
  | "familia"
  | "penal"
  | "administrativo"
  | "constitucional"
  | "transito";

export interface Senal {
  re: RegExp;
  peso: number;
  /** etiqueta legible para mostrar el conteo crudo en prompt/UI */
  nombre: string;
}

export interface MateriaConfig {
  slug: SlugMateria;
  nombre: string;
  /** señales fuertes: altamente específicas de la materia */
  senales: Senal[];
  /** claves de NORMA_IDS (bcnLeyChile.ts) semilla de la materia */
  normasSemilla: string[];
  /** ids de PLAZOS (plazosChile.ts) aplicables; [] = sin plazos modelados */
  plazos: string[];
}

const s = (nombre: string, fuente: string, peso = 1): Senal => ({
  nombre,
  peso,
  // i: sin case-sensitive; los acentos se manejan normalizando el texto antes.
  re: new RegExp(fuente, "g"),
});

export const MATERIAS: Record<SlugMateria, MateriaConfig> = {
  laboral: {
    slug: "laboral",
    nombre: "Laboral",
    senales: [
      s("despido", "despid[oa]|finiquito|autodespido|despido indirecto", 3),
      s("tutela laboral", "tutela laboral|ley karin|acoso laboral|hostigamiento", 3),
      s("cotizaciones/CT", "cotizaciones|codigo del trabajo|art. 161|articulo 161|art. 162|articulo 162|inspeccion del trabajo|direcci[o]?n del trabajo", 2),
      s("juzgado laboral", "juzgado de letras del trabajo|juzgado del trabajo|s\\.?j\\.?l\\b", 2),
      s("otros laboral", "trabajador|empleador|remuneraci[o]?n|horas extra|feriado laboral|a[nf]os de servicio|fuero maternal|fuero paternal|sindicato|negociaci[o]?n colectiva|huelga|cesant[i]?a|afc\\b|seguro de cesant[i]?a", 1),
    ],
    normasSemilla: ["CT"],
    plazos: ["laboral_contestacion", "laboral_apelacion"],
  },
  civil: {
    slug: "civil",
    nombre: "Civil",
    senales: [
      s("procedimiento civil", "notificaci[o]?n de la demanda|contestaci[o]?n de la demanda|notificado|notificada|c[eé]dula|exhorto|rebeld[i]?a|providencia|medida precautoria", 2),
      s("juzgado civil", "juzgado de letras en lo civil|juzgado civil|s\\.?j\\.?l\\b.*civil|rito c-", 2),
      s("obligaciones/CC", "codigo civil|art. 1543|articulo 1543|art. 2314|articulo 2314|incumplimiento|resoluci[o]?n del contrato|nulidad|usurpaci[o]?n|prescripci[o]?n (adquisitiva|extintiva)", 2),
      s("otros civil", "demanda|perjuicios|da[nf]os y perjuicios|indemnizaci[o]?n|contrato|arrendamiento|arriendo|pagar[eé]|cheque|t[ií]tulo ejecutivo|cobro|ejecutivo|fianza|hipoteca|usufructo|servidumbre|comunidad|partici[o]?n", 1),
    ],
    normasSemilla: ["CC", "CPC", "L18101", "L20720"],
    plazos: ["civil_contestacion", "civil_apelacion_auto", "civil_oposicion_medida"],
  },
  familia: {
    slug: "familia",
    nombre: "Familia",
    senales: [
      s("alimentos/tuición", "alimentos|pensi[o]?n alimenticia|tuici[o]?n|cuidado personal|r[eé]gimen de visitas|relaci[o]?n directa y regular", 3),
      s("juzgado de familia", "juzgado de familia|s\\.?j\\.?f\\.?|tribunal de familia", 3),
      s("otros familia", "divorcio|separaci[o]?n|violencia intrafamiliar|medida de protecci[o]?n|filaci[o]?n|adopci[o]?n|tutela\\b|curadur[ií]a|ley 19.968|ley 14.908|registro civil", 1),
    ],
    normasSemilla: ["L19968", "L14908"],
    plazos: ["familia_apelacion"],
  },
  penal: {
    slug: "penal",
    nombre: "Penal",
    senales: [
      s("procesal penal", "fiscal[ií]a|formalizaci[o]?n de la investigaci[o]?n|imputado|querellante|prisi[o]?n preventiva|sobreseimiento|defensor penal p[uú]blico|tribunal de juicio oral|garant[ií]a", 3),
      s("otros penal", "delito|querella|denuncia|pena|condena|absoluci[o]?n|dolo|culpa penal|codigo penal|cpp\\b|ley 19.696|ley 20.000|ley 20.084", 1),
    ],
    normasSemilla: ["CP", "CPP"],
    plazos: [],
  },
  administrativo: {
    slug: "administrativo",
    nombre: "Administrativo",
    senales: [
      s("protección/ilegalidad", "recurso de protecci[o]?n|reclamaci[o]?n de ilegalidad|acto administrativo|ilegalidad", 2),
      s("otros admin", "municipalidad|servicio p[uú]blico|contralor[ií]a|sumario administrativo|estatuto administrativo|ley 19.880|ley 20.285|decreto|resoluci[o]?n exenta|patente comercial|permiso de edificaci[o]?n", 1),
    ],
    normasSemilla: [],
    plazos: [],
  },
  constitucional: {
    slug: "constitucional",
    nombre: "Constitucional",
    senales: [
      s("TC/CPR", "tribunal constitucional|inaplicabilidad|inconstitucionalidad|requerimiento de inaplicabilidad|auto acordado", 3),
      s("otros constitucional", "derechos fundamentales|garant[ií]as constitucionales|art. 19|articulo 19|cpr\\b|constituci[o]?n pol[ií]tica|habeas corpus|amparo|protecci[o]?n constitucional", 1),
    ],
    normasSemilla: [],
    plazos: [],
  },
  transito: {
    slug: "transito",
    nombre: "Tránsito y Juzgado de Policía Local",
    senales: [
      s("Ley 18.290/JPL", "ley 18\\.290|juzgado de polic[ií]a local|polic[ií]a local|jpl\\b", 3),
      s("infracciones de tránsito", "infracci[o]?n de tr[aá]nsito|multa|tag\\b|permiso de circulaci[o]?n|licencia de conducir|alcoholemia|conducci[o]?n en estado de ebriedad|curso de educaci[o]?n vial|suspensi[o]?n de licencia|boleta de citaci[o]?n|denuncia por accidente de tr[aá]nsito", 2),
      s("accidentes de tránsito", "colisi[o]?n|choque|atropello|veh[ií]culo|autom[oó]vil|conductor|conduc[a-z]*", 1),
    ],
    normasSemilla: ["L18290", "L18287", "CP"],
    plazos: [], // sin plazos modelados: JPL requiere verificación BCN de Ley 18.287 (Fase H)
  },
};

export const SLUGS_MATERIA = new Set<SlugMateria>(Object.keys(MATERIAS) as SlugMateria[]);

/** Normaliza el área declarada por la UI a un slug del registro.
 *  "policia_local" (LegalArea del wizard) y "transito" caen en tránsito;
 *  "otro"/"indeterminada"/vacío -> null. Devuelve solo slugs conocidos. */
export function normalizarAreaDeclarada(area: string | null | undefined): SlugMateria | null {
  const a = (area || "").trim().toLowerCase();
  if (!a) return null;
  if (a === "policia_local" || a === "transito" || a === "tránsito") return "transito";
  if (a === "otro" || a === "indeterminada" || a === "auto") return null;
  return (SLUGS_MATERIA as Set<string>).has(a) ? (a as SlugMateria) : null;
}

export interface SenalDetectada { slug: SlugMateria; nombre: string; menciones: number }

export interface ClasificacionMateria {
  /** null = indeterminada (sin señales suficientes): NO se asume laboral */
  slug: SlugMateria | null;
  /** conteos crudos por materia (transparencia en prompt/UI) */
  scores: Array<{ slug: SlugMateria; puntos: number }>;
  /** señales individuales detectadas, para anotación visible */
  senales: SenalDetectada[];
  /** margen determinista top1-top2 (0 si solo hay una o ninguna) */
  margen: number;
}

/** Umbral mínimo de puntos para no clasificar con una sola palabra débil. */
const UMBRAL_PUNTOS = 2;

/** Clasificador determinista por conteo de señales. Sin red, sin LLM.
 *  Regla del dueño: esto SOLO sugiere — el área declarada manda y la
 *  discrepancia se anota (nunca bloquea). */
export function clasificarMateria(texto: string): ClasificacionMateria {
  const vacio: ClasificacionMateria = { slug: null, scores: [], senales: [], margen: 0 };
  if (!texto || !texto.trim()) return vacio;
  // sin tildes y minúsculas para que las señales sean robustas
  const t = texto.toLowerCase().slice(0, 20000)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const senales: SenalDetectada[] = [];
  const puntosPorMateria = new Map<SlugMateria, number>();
  for (const cfg of Object.values(MATERIAS)) {
    let puntos = 0;
    for (const sen of cfg.senales) {
      const re = new RegExp(sen.re.source, sen.re.flags);
      const m = t.match(re);
      if (m && m.length) {
        puntos += m.length * sen.peso;
        senales.push({ slug: cfg.slug, nombre: sen.nombre, menciones: m.length });
      }
    }
    if (puntos > 0) puntosPorMateria.set(cfg.slug, puntos);
  }
  const scores = Array.from(puntosPorMateria.entries())
    .map(([slug, puntos]) => ({ slug, puntos }))
    .sort((a, b) => b.puntos - a.puntos);
  if (!scores.length || scores[0].puntos < UMBRAL_PUNTOS) return { ...vacio, senales, scores };
  const margen = scores.length > 1 ? scores[0].puntos - scores[1].puntos : scores[0].puntos;
  return { slug: scores[0].slug, scores, senales, margen };
}

/** Decisión final de materia para el pipeline: el área declarada manda; las
 *  señales sugieren; la discrepancia se anota como conflicto visible. */
export interface ResolucionMateria {
  slug: SlugMateria | null;      // materia que GOBIERNA la recuperación
  origen: "declarada" | "senales" | "indeterminada";
  conflicto: string | null;      // anotación visible si declarada != señales
  clasificacion: ClasificacionMateria;
}

export function resolverMateria(areaDeclarada: string | null | undefined, texto: string): ResolucionMateria {
  const declarada = normalizarAreaDeclarada(areaDeclarada);
  const clas = clasificarMateria(texto);
  if (declarada) {
    const conflicto = clas.slug && clas.slug !== declarada
      ? `conflicto_materia: el caso fue declarado "${MATERIAS[declarada].nombre}" pero el texto muestra señales de "${MATERIAS[clas.slug].nombre}" (${clas.senales.filter(x => x.slug === clas.slug).map(x => `${x.nombre} x${x.menciones}`).join(", ")}). Se mantiene la declarada — confirma la materia.`
      : null;
    return { slug: declarada, origen: "declarada", conflicto, clasificacion: clas };
  }
  if (clas.slug) return { slug: clas.slug, origen: "senales", conflicto: null, clasificacion: clas };
  return { slug: null, origen: "indeterminada", conflicto: null, clasificacion: clas };
}

/** Línea de prompt honesta: materia que gobierna + conteos crudos, sin
 *  porcentajes de confianza inventados. */
export function lineaMateriaPrompt(r: ResolucionMateria): string {
  const goberna = r.slug ? MATERIAS[r.slug].nombre : "indeterminada (sin señales suficientes)";
  const origen = r.origen === "declarada" ? "declarada por el usuario (PREVALECE)" : r.origen === "senales" ? "detectada por señales del texto" : "sin área declarada ni señales";
  const detalle = r.clasificacion.scores.length
    ? ` Señales crudas: ${r.clasificacion.scores.map(x => `${MATERIAS[x.slug].nombre}=${x.puntos}`).join(", ")}.`
    : " Sin señales de materia en el texto.";
  return `MATERIA QUE GOBIERNA ESTE CASO: ${goberna} (${origen}).${detalle}${r.conflicto ? `\n[ANOTACIÓN] ${r.conflicto}` : ""}`;
}
