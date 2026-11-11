// materias.ts — Fase D: registro único de materias legales (fuente de verdad).
//
// Decisiones del dueño que este módulo materializa:
// 1. LA PLATAFORMA DECIDE LA MATERIA (Fase D.2): la detección determinista por
//    señales del texto prevalece cuando es concluyente (una señal fuerte y un
//    primer lugar único). El área declarada por el usuario es respaldo y
//    desempate cuando las señales son débiles o empatan. Toda discrepancia se
//    anota de forma visible (nunca bloquea). Antes el área declarada mandaba
//    siempre; como el formulario principal enviaba "civil" fijo, todo caso
//    terminaba siendo civil.
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
  /** reglas de contexto: átomos que deben coocurrir en una ventana de palabras */
  contexto: ReglaContexto[];
  /** anclas estructurales de alta confianza (tribunales con nombre propio,
   *  formatos de rol, escritura pública...). Son marcadores del documento, no
   *  hechos narrados: la negación NO las anula. Tope de 3 puntos por materia. */
  anclas: Senal[];
  /** claves de NORMA_IDS (bcnLeyChile.ts) semilla de la materia */
  normasSemilla: string[];
  /** ids de PLAZOS (plazosChile.ts) aplicables; [] = sin plazos modelados */
  plazos: string[];
}

/** Regla de contexto sobre átomos (prefijos normalizados, sin tildes).
 *  Si todos los átomos aparecen dentro de `ventana` palabras, suma `peso`.
 *  Esto es lo que desambigua: "tutela" sola no decide; "tutela"+"trabajo" sí. */
export interface ReglaContexto {
  nombre: string;
  atomos: string[];
  ventana: number;
  peso: number;
}

const s = (nombre: string, fuente: string, peso = 1): Senal => ({
  nombre,
  peso,
  // i: sin case-sensitive; los acentos se manejan normalizando el texto antes.
  re: new RegExp(fuente, "g"),
});

/** Atajo para declarar reglas de contexto legibles. */
const c = (nombre: string, atomos: string[], ventana: number, peso: number): ReglaContexto =>
  ({ nombre, atomos, ventana, peso });

/** Atajo para anclas estructurales (peso 2 por defecto; tope 3 por materia). */
const a = (nombre: string, fuente: string, peso = 2): Senal => ({
  nombre: `ancla:${nombre}`,
  peso,
  re: new RegExp(fuente, "g"),
});

/** Tope de contribución de las anclas estructurales por materia. */
const TOPE_ANCLAS = 3;

// ── Fase I: términos ambiguos, desambiguados por ORACIÓN ────────────────────
// Un término ambiguo ("multa", "pena", "conductor", "nulidad", "contratista"...)
// NO puntúa por sí solo: puntúa SOLO si sus palabras vecinas —en la misma
// oración— revelan de qué materia se trata. Sin vecinos: NEUTRO (0 puntos),
// y la abstención queda como evidencia visible. Esto corrige el caso real:
// "multa contractual de 50 UF por cada día de atraso" (cláusula penal civil)
// ya no dispara Tránsito, y "rentas de arrendamiento no percibidas" (lucro
// cesante) ya no dispara acciones de arrendamiento.
//
// Los átomos son PREFIJOS sin tildes (se comparan con borde de palabra sobre
// el texto normalizado): "polic" cubre "policía/policia/policía local".

export interface TerminoAmbiguo {
  nombre: string;
  /** patrón del término (sobre texto normalizado sin tildes) */
  re: RegExp;
  /** puntos que aporta a la materia cuando la oración la desambigua */
  peso: number;
  /** átomos vecinos que inclinan la mención hacia cada materia */
  vecinos: Partial<Record<SlugMateria, string[]>>;
  /** nota de neutralidad (evidencia visible para el prompt) */
  nota: string;
}

export const TERMINOS_AMBIGUOS: TerminoAmbiguo[] = [
  {
    nombre: "multa",
    re: /\bmult(?:a|as|o|aron|ando)\b/g,
    peso: 2,
    vecinos: {
      civil: ["clausul", "contractual", "convencional", "contrat", "atras", "uf", "obra", "mora", "garanti", "incumpl", "obligac", "suma alzada", "penal por"],
      transito: ["transit", "jpl", "polic", "licenc", "tag", "permiso de circulac", "circulac", "ebried", "alcohol", "veh[ií]cul", "autom[oó]vil", "automov", "conduc", "infracc", "peaje", "autopista", "velocidad", "pase diari", "conductor", "estacion"],
      laboral: ["previsional", "afp", "cotiz", "inspecci[oó]n del trabajo", "inspeccion del trabajo", "trabaj", "remuner", "sueld", "faena", "empleador"],
      administrativo: ["municipal", "alcald", "ordenanz", "sumario", "patente", "contralor", "decret", "clausura", "servicio p[uú]blico", "servicio public"],
    },
    nota: "multa sin contexto: puede ser cláusula penal (civil), multa de tránsito (JPL), previsional (laboral) o municipal (administrativo)",
  },
  {
    nombre: "conducir/conductor",
    re: /\bconduc\w*\b/g,
    peso: 2,
    vecinos: {
      transito: ["veh[ií]cul", "autom[oó]vil", "automov", "licenc", "transit", "ebried", "alcohol", "infracc", "calle", "avenida", "autopista", "peaje", "choc", "atropell", "conductor"],
    },
    nota: "conducir/conductor sin vehículo en la oración: no es tránsito (p. ej. 'conducta', 'conducir un negocio')",
  },
  {
    nombre: "pena/penal",
    re: /\bpena(?:l|les)?\b/g,
    peso: 2,
    vecinos: {
      civil: ["clausul", "contractual", "convencional", "mult", "uf", "obligac", "contrat", "atras"],
      penal: ["c[aá]rcel", "carcel", "presid", "reclus", "delit", "conden", "crimen", "fiscal", "imput", "querell", "prisi[oó]n", "prision"],
    },
    nota: "pena/penal sin contexto: 'cláusula penal' es civil, 'pena de cárcel' es penal",
  },
  {
    nombre: "nulidad",
    re: /\bnulidad\w*\b/g,
    peso: 2,
    vecinos: {
      laboral: ["despid", "trabaj", "empleador", "finiquit", "laboral", "cotiz"],
      civil: ["contrat", "acto", "escritur", "matrimoni", "sociedad", "compravent", "testament", "t[ií]tulo", "titulo"],
    },
    nota: "nulidad sin contexto: del despido (laboral) o del contrato/acto (civil)",
  },
  {
    nombre: "notificado/notificación",
    re: /\bnotificad[oa]s?\b/g,
    peso: 2,
    vecinos: {
      civil: ["demand", "juici", "escrit", "exhort", "providenci", "caus", "pagare", "ejecutiv"],
      laboral: ["despid", "finiquit", "carta de aviso", "trabaj", "inspeccion"],
    },
    nota: "notificado sin contexto: de la demanda (civil) o del despido (laboral)",
  },
  {
    nombre: "denuncia",
    re: /\bdenunc\w*\b/g,
    peso: 1,
    vecinos: {
      penal: ["delit", "fiscal", "polici", "carabin", "comisari", "hurt", "rob", "lesion", "querell", "ministerio p[uú]blico", "ministerio public"],
      laboral: ["intern", "inspeccion", "sindicat", "trabaj", "supervisor"],
      transito: ["accident", "transit", "veh[ií]cul", "conductor"],
    },
    nota: "denuncia sin contexto: penal (hurto/lesiones), laboral (interna) o de tránsito",
  },
  {
    nombre: "derechos fundamentales",
    re: /\bderechos fundamentales\b/g,
    peso: 1,
    vecinos: {
      laboral: ["tutela", "trabaj", "empleador", "supervisor", "sindicat", "jornada", "remuner"],
      constitucional: ["recurs", "garant", "constituc", "amparo", "protecci[oó]n", "proteccion"],
    },
    nota: "derechos fundamentales sin contexto: tutela laboral (CT 485) o garantía constitucional",
  },
  {
    nombre: "contratista/subcontrata/mandante",
    re: /\b(?:contratistas?|subcontrat\w+|mandantes?)\b/g,
    peso: 1,
    vecinos: {
      laboral: ["trabaj", "sueld", "remuner", "faen", "cotiz", "inspeccion", "empleador", "sindicat", "jornada"],
      civil: ["obra", "construccion", "constructo", "suma alzada", "nav", "casa", "proyect", "entrega", "edific", "departament", "inmueble", "plano"],
    },
    nota: "contratista sin contexto: relación laboral (art. 64 CT) o contrato de obra civil",
  },
];

/** Corte de oración para vecinos: punto, cierre, salto. La coma NO corta
 *  (una cláusula con la palabra y sus vecinos vive en la misma oración). */
const RE_ORACION = /[.!?\n;]+/g;

interface OracionRango { desde: number; hasta: number }

function partirEnOraciones(t: string): OracionRango[] {
  const cortes: number[] = [];
  RE_ORACION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_ORACION.exec(t)) !== null) cortes.push(m.index + m[0].length);
  cortes.push(t.length);
  const out: OracionRango[] = [];
  let inicio = 0;
  for (const fin of cortes) {
    if (fin > inicio) out.push({ desde: inicio, hasta: fin });
    inicio = fin;
  }
  return out;
}

/** ¿La oración normalizada contiene el átomo (prefijo con borde de palabra)? */
function contieneAtomo(oracionNorm: string, atomo: string): boolean {
  try {
    return new RegExp(`\\b${atomo}`, "i").test(oracionNorm);
  } catch {
    return oracionNorm.includes(atomo);
  }
}

export interface DesambiguacionTerminos {
  /** puntos aportados por materia */
  puntos: Map<SlugMateria, number>;
  /** evidencia legible por término (para prompt/UI) */
  evidencia: string[];
  /** términos sin vecinos (abstención visible, NO suman) */
  neutrales: string[];
  /** menciones por término y materia */
  senales: Array<{ slug: SlugMateria; nombre: string; menciones: number }>;
  /** menciones NEGADAS por la oración ("no existe multa municipal") cuya
   *  materia estaba clara por los vecinos: se anotan como negación de ESA
   *  materia (la señal no suma y queda como evidencia visible). */
  negadas: Array<{ slug: SlugMateria; nombre: string; menciones: number }>;
}

/** Fase I: resuelve cada término ambiguo con sus vecinos de oración.
 *  La materia con MÁS átomos vecinos distintos gana la mención; empate
 *  exacto cuenta para ambas (honestidad ante oraciones realmente mixtas).
 *  Las menciones cubiertas por una negación de existencia no suman, pero si
 *  sus vecinos revelaban la materia, se registran como negación de ella. */
export function desambiguarTerminos(t: string, rangosNegacion: RangoNegacion[]): DesambiguacionTerminos {
  const puntos = new Map<SlugMateria, number>();
  const evidencia: string[] = [];
  const neutrales: string[] = [];
  const senales: Array<{ slug: SlugMateria; nombre: string; menciones: number }> = [];
  const negadas: Array<{ slug: SlugMateria; nombre: string; menciones: number }> = [];
  if (!t || !t.trim()) return { puntos, evidencia, neutrales, senales, negadas };
  const oraciones = partirEnOraciones(t);
  const oracionDe = (pos: number): string => {
    const o = oraciones.find((r) => pos >= r.desde && pos < r.hasta);
    return o ? t.slice(o.desde, o.hasta) : t.slice(Math.max(0, pos - 120), pos + 120);
  };
  for (const term of TERMINOS_AMBIGUOS) {
    const re = new RegExp(term.re.source, "gi");
    const porMateria = new Map<SlugMateria, number>();
    const negadasPorMateria = new Map<SlugMateria, number>();
    let neutras = 0;
    for (const mm of t.matchAll(re)) {
      const pos = mm.index ?? 0;
      const esNegada = estadoEn(rangosNegacion, pos) === "NEGADA";
      const oracion = oracionDe(pos);
      const oracionNorm = oracion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let mejor: SlugMateria | null = null;
      let mejorHits = 0;
      let empate = false;
      for (const [slug, atomos] of Object.entries(term.vecinos) as Array<[SlugMateria, string[]]>) {
        const hits = atomos.filter((at) => contieneAtomo(oracionNorm, at)).length;
        if (hits > mejorHits) { mejor = slug; mejorHits = hits; empate = false; }
        else if (hits === mejorHits && hits > 0 && slug !== mejor) { empate = true; }
      }
      if (!mejor || mejorHits === 0) { neutras++; continue; }
      const acreditadas: SlugMateria[] = empate
        ? (Object.entries(term.vecinos) as Array<[SlugMateria, string[]]>)
            .filter(([slug, atomos]) => atomos.some((at) => contieneAtomo(oracionNorm, at)))
            .map(([slug]) => slug)
        : [mejor];
      for (const slug of acreditadas) {
        if (esNegada) {
          // "No existe multa municipal": la mención no suma, pero queda como
          // negación de la materia que los vecinos revelaban.
          negadasPorMateria.set(slug, (negadasPorMateria.get(slug) ?? 0) + 1);
        } else {
          porMateria.set(slug, (porMateria.get(slug) ?? 0) + term.peso);
        }
      }
    }
    for (const [slug, pts] of porMateria) {
      puntos.set(slug, (puntos.get(slug) ?? 0) + pts);
      const menciones = pts / term.peso;
      senales.push({ slug, nombre: `ambiguo:${term.nombre}→${slug}`, menciones });
      evidencia.push(`"${term.nombre}" en oración(es) de ${MATERIAS[slug].nombre}: +${pts} (vecinos desambiguan)`);
    }
    for (const [slug, n] of negadasPorMateria) {
      negadas.push({ slug, nombre: `ambiguo:${term.nombre}→${slug}`, menciones: n });
      evidencia.push(`"${term.nombre}" NEGADO en oración de ${MATERIAS[slug].nombre}: no suma (negación de existencia)`);
    }
    if (neutras > 0) {
      neutrales.push(`"${term.nombre}" x${neutras} SIN vecinos de materia (${term.nota}): 0 puntos, no dispara materia`);
    }
  }
  return { puntos, evidencia, neutrales, senales, negadas };
}

export const MATERIAS: Record<SlugMateria, MateriaConfig> = {
  laboral: {
    slug: "laboral",
    nombre: "Laboral",
    senales: [
      // Laguna morfológica detectada por el set dorado (test 25): hay DOS
      // familias y ambas aparecen en el corpus real (125× "despido" sustantivo
      // vs 6× participio "despedid+o"). "despid\\w*" solo cubre la primera;
      // "desped\\w*" agrega participio/despedir/despedirse (verificado contra
      // data/corpus-full: 12/12 formas observadas cubiertas).
      s("despido", "despid\\w*|desped\\w*|finiquito|autodespido", 3),
      s("tutela laboral", "tutela laboral|ley karin|acoso laboral|hostigamiento", 3),
      s("cotizaciones/CT", "cotizaciones|imposiciones previsionales|mora previsional|ley\\s*bustos|codigo del trabajo|art. 161|articulo 161|art. 162|articulo 162|inspeccion del trabajo|direcci[o]?n del trabajo", 2),
      s("juzgado laboral", "juzgado de letras del trabajo|juzgado del trabajo|s\\.?j\\.?l\\b", 2),
      s("otros laboral", "trabajador|empleador|remuneraci[o]?n|horas extra|feriado laboral|a[nf]os de servicio|fuero maternal|fuero paternal|sindicato|negociaci[o]?n colectiva|huelga|cesant[i]?a|afc\\b|seguro de cesant[i]?a", 1),
    ],
    contexto: [
      c("despido+injustificado", ["despid|desped", "injustific"], 4, 3),
      c("despido+necesidades+empresa", ["despid|desped", "necesidad", "empres"], 8, 4),
      c("despido+represalia", ["despid|desped", "represalia"], 6, 4),
      c("echaron+represalia", ["ech", "represalia"], 6, 3),
      c("echar+trabajo", ["ech", "trabaj"], 6, 3),
      c("tutela+laboral", ["tutela", "laboral"], 3, 4),
      c("tutela+trabajo", ["tutela", "trabaj"], 5, 4),
      c("acoso+laboral", ["acoso", "laboral"], 3, 4),
      c("acoso+sexual+trabajo", ["acoso", "sexual", "trabaj"], 8, 4),
      c("finiquito+cotizacion", ["finiquit", "cotizacion"], 8, 3),
      c("despido+cotizaciones", ["despid|desped|finiquito", "cotiz|previsional|imposicion"], 8, 3),
      c("juzgado+trabajo", ["juzgado", "trabajo"], 4, 3),
      c("direccion+trabajo", ["direccion", "trabajo"], 4, 3),
      c("contrato+trabajo", ["contrato", "trabajo"], 4, 3),
      c("remuneracion+trabajador", ["remuneracion", "trabajador"], 8, 3),
      c("empleador+trabajador", ["empleador", "trabajador"], 8, 2),
      c("huelga+sindicato", ["huelga", "sindicato"], 6, 3),
      c("fuero+maternal", ["fuero", "maternal"], 4, 3),
    ],
    anclas: [
      a("audiencia preparatoria", "audiencia preparatoria"),
      a("dinaco", "\\bdinaco\\b", 1),
    ],
    normasSemilla: ["CT" , "L17322", "L19728", "L20585", "L19631", "L21220", "L20609"],
    // Fase E: sin plazos laborales verificados — el CT vigente NO fija plazo de
    // 15 días para contestar (la contestación es en la audiencia preparatoria,
    // CT 451/452) y el canal leychile del CT trunca en art. 519 (no hay forma
    // de sentenciar el 533). Honestidad estricta: [] antes que una cita
    // refutada; los drafts laborales reciben [VERIFICACION DE PLAZOS].
    plazos: [],
  },
  civil: {
    slug: "civil",
    nombre: "Civil",
    senales: [
      // Fase I: "notificado|notificada" migró a TERMINOS_AMBIGUOS (una
      // notificación puede ser de demanda civil O de despido laboral); las
      // frases completas siguen aquí.
      s("procedimiento civil", "notificaci[o]?n de la demanda|contestaci[o]?n de la demanda|c[eé]dula|exhorto|rebeld[i]?a|providencia|medida precautoria", 2),
      s("juzgado civil", "juzgado de letras en lo civil|juzgado civil|s\\.?j\\.?l\\b.*civil|rito c-", 2),
      // Fase I: "nulidad" sola migró a TERMINOS_AMBIGUOS ("nulidad del despido"
      // es laboral; "nulidad del contrato/acto" es civil).
      s("obligaciones/CC", "codigo civil|art. 1543|articulo 1543|art. 2314|articulo 2314|incumplimiento|resoluci[o]?n del contrato|usurpaci[o]?n|prescripci[o]?n (adquisitiva|extintiva)", 2),
      s("otros civil", "demanda|perjuicios|da[nf]os y perjuicios|indemnizaci[o]?n|contrato|arrendamiento|arriendo|pagar[eé]|cheque|t[ií]tulo ejecutivo|cobro|ejecutivo|fianza|hipoteca|usufructo|servidumbre|comunidad|partici[o]?n", 1),
    ],
    contexto: [
      c("demanda+civil", ["demanda", "civil"], 4, 3),
      c("juzgado+civil", ["juzgado", "civil"], 4, 3),
      c("incumplimiento+contrato", ["incumplimiento", "contrato"], 4, 3),
      c("indemnizacion+perjuicios", ["indemnizacion", "perjuicio"], 4, 3),
      c("titulo+ejecutivo", ["titulo", "ejecutivo"], 4, 3),
      c("pagare+letra", ["pagare", "letra"], 6, 3),
      c("arrendamiento+renta", ["arrendamiento", "renta"], 6, 3),
      c("prescripcion+adquisitiva", ["prescripcion", "adquisitiva"], 4, 3),
      c("medida+precautoria", ["medida", "precautoria"], 4, 3),
      c("notificacion+demanda", ["notificacion", "demanda"], 5, 2),
      c("cobro+deuda", ["cobro", "deuda"], 6, 2),
      c("hipoteca+banco", ["hipoteca", "banco"], 6, 3),
      c("embargo+casa", ["embargo", "casa"], 6, 3),
      c("deuda+casa", ["deuda", "casa"], 6, 3),
      // Depósito de garantía del arriendo: "no me quiere devolver la garantía"
      // es un incumplimiento afirmado, no una negación del hecho.
      c("garantia+devolucion", ["garantia", "devolv"], 8, 3),
      c("garantia+arriendo", ["garantia", "arriendo"], 6, 3),
      c("garantia+casa", ["garantia", "casa"], 6, 3),
    ],
    anclas: [
      a("escritura publica", "escritura p[uú]blica"),
      a("notario", "\\bnotari[oa]\\b"),
      a("conservador de bienes raices", "conservador de bienes ra|\\bcbr\\b"),
      a("rol C", "\\brol\\s+C\\s*-"),
    ],
    normasSemilla: ["CC", "CPC", "L18101", "L20720" , "L18010", "L18092", "L16271", "L20886", "L19537", "L19799"],
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
    contexto: [
      c("pension+alimentos", ["pension", "alimento"], 4, 4),
      // "hij" cubre hijo/hija/hijos/hijas.
      c("alimentos+hijo", ["alimento", "hij"], 6, 3),
      c("pension+hijo", ["pension", "hij"], 6, 3),
      c("cuidado+personal", ["cuidado", "personal"], 4, 3),
      c("relacion+directa+regular", ["relacion", "directa", "regular"], 8, 3),
      c("juzgado+familia", ["juzgado", "familia"], 4, 3),
      c("divorcio+matrimonio", ["divorcio", "matrimonio"], 6, 3),
      c("violencia+intrafamiliar", ["violencia", "intrafamiliar"], 4, 4),
      c("tutela+nino", ["tutela", "nino"], 6, 3),
      c("tuicion+hijo", ["tuicion", "hij"], 6, 3),
      c("filiacion+paternidad", ["filiacion", "paternidad"], 6, 3),
    ],
    anclas: [
      a("mediacion familiar", "mediaci[o]?n familiar"),
    ],
    normasSemilla: ["L19968", "L14908" , "L21400", "L20830", "L19585", "L21120", "L16618", "L21302"],
    plazos: ["familia_apelacion"],
  },
  penal: {
    slug: "penal",
    nombre: "Penal",
    senales: [
      s("procesal penal", "fiscal[ií]a|formalizaci[o]?n de la investigaci[o]?n|imputado|querellante|prisi[o]?n preventiva|sobreseimiento|defensor penal p[uú]blico|tribunal de juicio oral|tribunal de garant[ií]a", 3),
      // Fase I: "pena" y "denuncia" migraron a TERMINOS_AMBIGUOS ("cláusula
      // penal" es civil; "denuncia interna" es laboral; "denuncia de hurto"
      // es penal). La frase completa "codigo penal" sigue aquí.
      s("otros penal", "delito|querella|condena|absoluci[o]?n|dolo|culpa penal|codigo penal|cpp\\b|ley 19.696|ley 20.000|ley 20.084", 1),
    ],
    contexto: [
      c("fiscalia+imputado", ["fiscalia", "imputado"], 8, 4),
      c("formalizacion+investigacion", ["formalizacion", "investigacion"], 5, 4),
      c("prision+preventiva", ["prision", "preventiva"], 4, 4),
      c("delito+pena", ["delito", "pena"], 8, 2),
      c("querella+delito", ["querella", "delito"], 8, 3),
      c("tribunal+juicio+oral", ["tribunal", "juicio", "oral"], 8, 3),
      c("defensor+penal", ["defensor", "penal"], 4, 3),
      c("denuncia+fiscalia", ["denuncia", "fiscalia"], 6, 3),
      c("condena+delito", ["condena", "delito"], 8, 2),
    ],
    anclas: [
      a("RUC", "\\bruc\\b"),
      a("audiencia de formalizacion", "audiencia de formalizaci[o]?n"),
    ],
    normasSemilla: ["CP", "CPP", "L20393"],
    plazos: [],
  },
  administrativo: {
    slug: "administrativo",
    nombre: "Administrativo",
    senales: [
      s("protección/ilegalidad", "recurso de protecci[o]?n|reclamaci[o]?n de ilegalidad|acto administrativo|ilegalidad", 2),
      s("otros admin", "municipalidad|servicio p[uú]blico|contralor[ií]a|sumario administrativo|estatuto administrativo|ley 19.880|ley 20.285|decreto|resoluci[o]?n exenta|patente comercial|permiso de edificaci[o]?n", 1),
    ],
    contexto: [
      c("acto+administrativo", ["acto", "administrativo"], 4, 3),
      c("reclamacion+ilegalidad", ["reclamacion", "ilegalidad"], 4, 3),
      c("municipalidad+patente", ["municipalidad", "patente"], 6, 3),
      c("sumario+administrativo", ["sumario", "administrativo"], 4, 3),
      c("contraloria+resolucion", ["contraloria", "resolucion"], 8, 2),
      c("servicio+publico+resolucion", ["servicio", "publico", "resolucion"], 8, 2),
      c("ley+19880", ["ley", "19880"], 3, 3),
      c("permiso+edificacion", ["permiso", "edificacion"], 4, 3),
      c("municipio+clausura", ["municipio", "clausura"], 6, 3),
      c("municipalidad+multa", ["municipalidad", "multa"], 6, 2),
    ],
    anclas: [
      a("decreto alcaldicio", "decreto alcaldicio"),
      a("toma de razon", "toma de raz[o]?n"),
    ],
    normasSemilla: ["L20285", "L20422", "L20584", "L19966", "L19253"],
    plazos: [],
  },
  constitucional: {
    slug: "constitucional",
    nombre: "Constitucional",
    senales: [
      s("TC/CPR", "tribunal constitucional|inaplicabilidad|inconstitucionalidad|requerimiento de inaplicabilidad|auto acordado", 3),
      // Fase I: "derechos fundamentales" migró a TERMINOS_AMBIGUOS (con
      // "tutela/trabajador/empleador" en la oración es laboral —tutela CT
      // 485—; con "recurso/garantía/constitución" es constitucional).
      s("otros constitucional", "garant[ií]as constitucionales|art. 19|articulo 19|cpr\\b|constituci[o]?n pol[ií]tica|habeas corpus|amparo|protecci[o]?n constitucional", 1),
    ],
    contexto: [
      c("recurso+proteccion", ["recurso", "proteccion"], 4, 3),
      c("tribunal+constitucional", ["tribunal", "constitucional"], 4, 4),
      c("inaplicabilidad+constitucional", ["inaplicabilidad", "constitucional"], 6, 4),
      c("inconstitucionalidad+requerimiento", ["inconstitucionalidad", "requerimiento"], 6, 3),
      c("derechos+fundamentales+garantias", ["derechos", "fundamentales", "garantia"], 8, 2),
      c("habeas+corpus", ["habeas", "corpus"], 4, 4),
      c("amparo+constitucional", ["amparo", "constitucional"], 4, 3),
      c("auto+acordado", ["auto", "acordado"], 4, 2),
      c("proteccion+salud", ["proteccion", "salud"], 8, 2),
    ],
    anclas: [
      a("corte de apelaciones", "corte de apelaciones"),
      a("recurso de amparo", "recurso de amparo"),
      a("amparo economico", "amparo econ[o]?mico"),
    ],
    normasSemilla: ["L20609", "L20285"],
    plazos: [],
  },
  transito: {
    slug: "transito",
    nombre: "Tránsito y Juzgado de Policía Local",
    senales: [
      s("Ley 18.290/JPL", "ley 18\\.290|juzgado de polic[ií]a local|polic[ií]a local|jpl\\b", 3),
      s("infracciones de tránsito", "infracci[o]?n de tr[aá]nsito|tag\\b|permiso de circulaci[o]?n|licencia de conducir|alcoholemia|conducci[o]?n en estado de ebriedad|curso de educaci[o]?n vial|suspensi[o]?n de licencia|boleta de citaci[o]?n|denuncia por accidente de tr[aá]nsito", 2),
      // Fase I: "multa" ya no es señal (caso real: cláusula penal de
      // construcción la disparaba). "conductor|conduc[a-z]*" migró a
      // TERMINOS_AMBIGUOS ("conducta", "conducir negocios" no son tránsito).
      s("accidentes de tránsito", "colisi[o]?n|choque|atropello|veh[ií]culo|autom[oó]vil", 1),
    ],
    contexto: [
      c("juzgado+policia+local", ["juzgado", "policia", "local"], 8, 4),
      c("infraccion+transito", ["infraccion", "transito"], 4, 4),
      c("licencia+conducir", ["licencia", "conducir"], 4, 4),
      c("alcoholemia+conduc", ["alcoholemia", "conduc"], 8, 4),
      c("alcohol+manejar", ["alcohol", "manej"], 6, 3),
      c("accidente+transito", ["accidente", "transito"], 4, 3),
      c("multa+tag", ["multa", "tag"], 6, 3),
      c("ley+18290", ["ley", "18290"], 3, 4),
      c("boleta+citacion", ["boleta", "citacion"], 4, 3),
      c("permiso+circulacion", ["permiso", "circulacion"], 4, 3),
    ],
    anclas: [
      a("TAG", "\\btag\\b"),
      a("pase diario", "pase diari[oa]"),
    ],
    normasSemilla: ["L18290", "L18287", "L15231", "L18490", "CP"],
    // Fase H: corpus propio ingerido desde XML oficial BCN + doctrina arbitrada (scripts/corpus_ingest_transito.py -> data/corpus-full/transito.json)
    plazos: ["transito_apelacion_jpl"],
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

/** Fase D.3: estado de una señal según la negación del texto. */
export type EstadoSenal = "POSITIVA" | "DEBILITADA" | "NEGADA";

export interface SenalDetectada {
  slug: SlugMateria;
  nombre: string;
  menciones: number;
  /** POSITIVA suma completo; DEBILITADA suma 0.25; NEGADA no suma. */
  estado?: EstadoSenal;
}

export interface ClasificacionMateria {
  /** null = indeterminada (sin señales suficientes): NO se asume laboral */
  slug: SlugMateria | null;
  /** conteos crudos por materia (transparencia en prompt/UI) */
  scores: Array<{ slug: SlugMateria; puntos: number }>;
  /** señales individuales detectadas, para anotación visible */
  senales: SenalDetectada[];
  /** margen determinista top1-top2 (0 si solo hay una o ninguna) */
  margen: number;
  /** señales anuladas por negación (evidencia visible, no bloqueo) */
  negaciones: string[];
  /** incumplimientos afirmados ("no me pagaron"): el hecho existe, no se anula */
  incumplimientos: string[];
  /** señales negadas y positivas de la misma materia en el mismo texto */
  conflictos: string[];
  /** Fase I: materias con evidencia FUERTE (señal peso>=3, contexto peso>=3
   *  o ancla). Una materia secundaria sin evidencia fuerte es ruido de
   *  palabras genéricas repetidas y NO se reporta como secundaria. */
  materiasFuertes: SlugMateria[];
  /** Fase I: evidencia de la desambiguación por oración (visible en prompt) */
  ambiguos: { evidencia: string[]; neutrales: string[] };
  /** Fase I: empate de puntos roto por señales directas fuertes (una señal
   *  nombrada —"despido", "alcoholemia"— pesa más que una co-ocurrencia de
   *  contexto cuando los puntos empatan). false = empate real → se abstiene. */
  desempateDirecto: boolean;
}

/** Umbral mínimo de puntos para no clasificar con una sola palabra débil. */
const UMBRAL_PUNTOS = 2;

/** Fase I: peso mínimo de una señal/contexto para contar como evidencia
 *  FUERTE de una materia (habilita secundarias; ver ClasificacionMateria). */
const PESO_SENAL_FUERTE = 3;

// ── Negación por oración (Fase D.3, v2) ────────────────────────────────────
// Dos tipos de negación con efectos distintos:
//  - EXISTENCIA niega el hecho ("no hubo despido", "sin contrato", "ningún
//    finiquito", "no corresponde pensión") => anula la señal (NEGADA).
//  - ACCIÓN niega un acto del contratante ("no me pagaron el finiquito",
//    "no me quiere devolver la garantía") => es un INCUMPLIMIENTO AFIRMADO:
//    el hecho existe y suele ser la pretensión. NO anula; se anota.
// Sin esta distinción, "Me echaron y no me pagaron el finiquito" mataba la
// señal laboral más fuerte del relato.
//
// El alcance llega hasta la puntuación (. ! ? , ; : o salto de línea) — la
// coma y el dos puntos son cortes de CLÁUSULA: sin ellos, "sin aviso ni
// escrito, … presente autodespido" dejaba que la negación de "aviso" matara
// "autodespido" 60 caracteres más allá (hallazgo del set dorado L7) — o hasta
// un marcador de contraste (sino/pero/aunque/...), con tope de caracteres
// para que un "no" lejano no niegue otra cláusula.

const RE_PUNTUACION_FUERTE = /[.!?,;:\n]/g;
const RE_CONTRASTE = /\b(?:sino|pero|aunque|no obstante|sin embargo|mas bien|en cambio|por el contrario)\b/g;
const RE_DISPARADOR = /\b(?:no|sin|nunca|jamas|tampoco|ni|ningun|ninguna|ninguno)\b/g;
/** Hedge: el usuario no afirma la negación, la conjetura ("creo que no..."). */
const RE_HEDGE = /\b(?:creo|pienso|tal vez|quizas|posiblemente|probablemente|me parece|no estoy seguro|no se si)\b/;
/** Ignorancia: "no sé a qué área / dónde / si..." — no afirma ni niega nada. */
const RE_IGNORANCIA =
  /^\s*(?:se\s+(?:si|a\s+|que|donde|cuando|quien|como|puedo)|sabe\b|sabia\b|supo\b|recuerdo\b|conozco\b|entiendo\b|imagino\b)/;
/** Verbo de existencia/cópula tras el disparador => niega el hecho. Permite
 *  clíticos y artículos intercalados ("no ME pagaron" => verbo pagó => acción).
 *  Incluye "fui": "no fui despedido" es negación de existencia (hallazgo del
 *  set dorado N1, donde antes solo cubría "fue"). */
const RE_VERBO_EXISTENCIA =
  /^\s*(?:(?:me|le|lo|la|los|las|les|se|nos|os|que|el|la|lo|los|las|un|una|algun|alguna|ningun|ninguna)\s+)*(?:hub\w*|exist\w*|correspond\w*|proced\w*|fue|fueron|fuera\w*|fui|fuiste|fuimos|es|era|eran|son|sean|ser\w*|hay|habra|habria)\b/;
/** Pasiva con participio de RECIBO ("no fui pagado/notificado/indemnizado"):
 *  el hecho es un incumplimiento (acción), NO una negación de existencia.
 *  Sin esta guarda, agregar "fui" habría matado la señal de "no fui pagado el
 *  finiquito" — el mismo error que la Fase D.3 vino a corregir. */
const RE_PASIVA_RECEIBO =
  /\b(?:fui|fue|fueron|fuera|era|eran|es|son|sean)\s+(?:[a-z]{2,}\s+){0,3}?(?:pag\w*|deposit\w*|abon\w*|notific\w*|indemniz\w*|compens\w*|remuner\w*|cotiz\w*|avis\w*|convoc\w*|cit\w*|llam\w*|entreg\w*|devolv\w*|reintegr\w*)\b/;
/** ~13 palabras: tope de alcance de una negación de existencia. */
const MAX_ALCANCE_NEGACION = 80;

interface RangoNegacion { desde: number; hasta: number; debil: boolean; disparador: string }

/** Resultado del análisis de negación: rangos que ANULAN (existencia) y las
 *  notas de incumplimiento afirmado (acción), con su evidencia textual. */
interface AnalisisNegacion {
  rangos: RangoNegacion[];
  incumplimientos: string[];
}

function analizarNegacion(t: string): AnalisisNegacion {
  const rangos: RangoNegacion[] = [];
  const incumplimientos: string[] = [];
  const cortes: number[] = [];
  RE_PUNTUACION_FUERTE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_PUNTUACION_FUERTE.exec(t)) !== null) cortes.push(m.index);
  cortes.push(t.length);
  let inicio = 0;
  for (const fin of cortes) {
    if (fin <= inicio) { inicio = fin + 1; continue; }
    const oracion = t.slice(inicio, fin);
    const contrastes: number[] = [];
    RE_CONTRASTE.lastIndex = 0;
    while ((m = RE_CONTRASTE.exec(oracion)) !== null) contrastes.push(inicio + m.index);
    RE_DISPARADOR.lastIndex = 0;
    while ((m = RE_DISPARADOR.exec(oracion)) !== null) {
      const palabra = m[0];
      const pos = inicio + m.index;
      const resto = oracion.slice(m.index + palabra.length);
      // "sin embargo" es contraste, no negación; "no solo" tampoco niega.
      if (palabra === "sin" && /^\s+embargo\b/.test(resto)) continue;
      if (palabra === "no" && /^\s+(?:solo|solamente)\b/.test(resto)) continue;
      // "no sé a qué área corresponde" es IGNORANCIA del usuario: ni hecho
      // negado (no anula señal) ni incumplimiento (no se afirma nada). Solo
      // aplica a verbos de conocimiento con pregunta indirecta: "no se
      // celebró contrato" NO entra aquí (sigue siendo negación de existencia).
      if (palabra === "no" && RE_IGNORANCIA.test(resto)) continue;
      const hasta = Math.min(
        contrastes.find((c) => c > pos) ?? fin,
        pos + MAX_ALCANCE_NEGACION,
        fin,
      );
      // Clasificación del disparador: "sin"/"ningún" niegan presencia siempre;
      // el resto (no/nunca/jamás/tampoco/ni) solo si sigue un verbo de
      // existencia. Si sigue un verbo de acción => incumplimiento afirmado.
      // Excepción: pasiva con participio de recibо ("no fui pagado") = acción.
      const niegaHecho = palabra === "sin" || palabra.startsWith("ningun")
        ? true
        : RE_VERBO_EXISTENCIA.test(resto) && !RE_PASIVA_RECEIBO.test(resto);
      if (!niegaHecho) {
        const frase = oracion.slice(m.index).slice(0, 70).trim() || palabra;
        incumplimientos.push(`"${frase}${frase.length >= 70 ? "…" : ""}" es un hecho afirmado (incumplimiento): la señal no se anula`);
        continue;
      }
      const debil = RE_HEDGE.test(oracion.slice(Math.max(0, m.index - 45), m.index));
      rangos.push({ desde: pos, hasta, debil, disparador: palabra });
    }
    inicio = fin + 1;
  }
  return { rangos, incumplimientos };
}

/** Estado de un átomo/coincidencia según los rangos de negación. NEGADA gana
 *  a DEBILITADA (si una negación firme lo cubre, no suma). */
function estadoEn(rangos: RangoNegacion[], pos: number): EstadoSenal {
  let estado: EstadoSenal = "POSITIVA";
  for (const r of rangos) {
    if (pos >= r.desde && pos < r.hasta) {
      if (r.debil) { if (estado === "POSITIVA") estado = "DEBILITADA"; }
      else return "NEGADA";
    }
  }
  return estado;
}

/** Atomiza el texto normalizado y devuelve también la posición de cada átomo
 *  (para poder consultar la negación por offset). */
function atomizarConPosiciones(t: string): { tokens: string[]; pos: number[] } {
  const tokens: string[] = [];
  const pos: number[] = [];
  const re = /[a-z0-9]{3,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) { tokens.push(m[0]); pos.push(m.index); }
  return { tokens, pos };
}

/** ¿Coocurren TODOS los átomos de la regla dentro de su ventana de palabras?
 *  Devuelve las posiciones elegidas (para consultar negación) o null.
 *  Se ancla en cada aparición del primer átomo y busca los demás cerca
 *  (± ventana). Así "tutela" sola no decide, pero "tutela"+"trabajo" sí. */
function matchContexto(tokens: string[], regla: ReglaContexto): number[] | null {
  if (!regla.atomos.length) return null;
  // Un átomo puede declarar alternativas con "|" ("despid|desped"): cubre
  // morfología irregular sin duplicar la regla.
  const posiciones: number[][] = regla.atomos.map((a) => {
    const prefijos = a.split("|").filter(Boolean);
    const out: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (prefijos.some((p) => tokens[i].startsWith(p))) out.push(i);
    }
    return out;
  });
  if (posiciones.some((p) => p.length === 0)) return null;
  for (const p0 of posiciones[0]) {
    const elegidos = [p0];
    let min = p0, max = p0, ok = true;
    for (let k = 1; k < posiciones.length; k++) {
      let mejor = -1, mejorDist = Infinity;
      for (const p of posiciones[k]) {
        const d = Math.abs(p - p0);
        if (d <= regla.ventana && d < mejorDist) { mejor = p; mejorDist = d; }
      }
      if (mejor < 0) { ok = false; break; }
      elegidos.push(mejor);
      min = Math.min(min, mejor); max = Math.max(max, mejor);
    }
    if (ok && max - min <= regla.ventana) return elegidos;
  }
  return null;
}

/** Peso de una señal debilitada (negación conjetural). */
const PESO_DEBILITADA = 0.25;

/** Clasificador determinista por átomos + ventana + negación. Sin red, sin LLM.
 *  Regla del dueño: esto decide cuando es concluyente; el área declarada es
 *  respaldo y desempate, y la discrepancia se anota (nunca bloquea). */
export function clasificarMateria(texto: string): ClasificacionMateria {
  const vacio: ClasificacionMateria = {
    slug: null, scores: [], senales: [], margen: 0, negaciones: [], incumplimientos: [], conflictos: [],
    materiasFuertes: [], ambiguos: { evidencia: [], neutrales: [] }, desempateDirecto: false,
  };
  if (!texto || !texto.trim()) return vacio;
  // sin tildes y minúsculas para que las señales sean robustas
  const t = texto.toLowerCase().slice(0, 20000)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { rangos, incumplimientos } = analizarNegacion(t);
  const { tokens, pos } = atomizarConPosiciones(t);
  // Fase I: términos ambiguos resueltos con sus vecinos de oración.
  const amb = desambiguarTerminos(t, rangos);
  const senales: SenalDetectada[] = [
    ...amb.senales.map((x) => ({ ...x, estado: "POSITIVA" as EstadoSenal })),
    ...amb.negadas.map((x) => ({ ...x, estado: "NEGADA" as EstadoSenal })),
  ];
  const negaciones: string[] = [];
  const conflictos: string[] = [];
  const fuertes = new Set<SlugMateria>();
  // Señales directas fuertes por materia (para el desempate de empates).
  const fuertesDirectas = new Map<SlugMateria, number>();
  const puntosPorMateria = new Map<SlugMateria, number>();

  for (const cfg of Object.values(MATERIAS)) {
    let puntos = 0;
    const negadas: string[] = [];
    const positivas: string[] = [];
    for (const sen of cfg.senales) {
      const flags = sen.re.flags.includes("g") ? sen.re.flags : sen.re.flags + "g";
      const re = new RegExp(sen.re.source, flags);
      let men = 0, neg = 0, deb = 0;
      for (const mm of t.matchAll(re)) {
        const est = estadoEn(rangos, mm.index ?? 0);
        if (est === "NEGADA") neg++;
        else if (est === "DEBILITADA") { deb++; men++; }
        else men++;
      }
      // Fase I — tope por familia: una señal NO crece lineal con las menciones
      // ("demanda" x5 valía 5 puntos y fabricaba secundarias fantasma). La 1ª
      // mención suma plena, las siguientes aportan 15% c/u con tope +1; una
      // debilitada suma una sola vez al 25%.
      const plenas = men - deb;
      if (plenas > 0) {
        puntos += sen.peso + Math.min(1, 0.15 * (plenas - 1));
        if (sen.peso >= PESO_SENAL_FUERTE) {
          fuertes.add(cfg.slug);
          fuertesDirectas.set(cfg.slug, (fuertesDirectas.get(cfg.slug) ?? 0) + 1);
        }
      }
      if (deb > 0) puntos += sen.peso * PESO_DEBILITADA;
      if (men > 0) {
        senales.push({ slug: cfg.slug, nombre: sen.nombre, menciones: men, estado: deb > 0 ? "DEBILITADA" : "POSITIVA" });
        positivas.push(`${sen.nombre} x${men}${deb > 0 ? " (debilitada)" : ""}`);
      }
      if (neg > 0) {
        senales.push({ slug: cfg.slug, nombre: sen.nombre, menciones: neg, estado: "NEGADA" });
        negadas.push(`${sen.nombre} x${neg}`);
      }
    }
    // Capa de contexto: átomos colindantes. Desambigua palabras sueltas y
    // premia frases que en el corpus legal van juntas. Si la negación cubre
    // todos los átomos, la regla no suma; si cubre parte, se debilita.
    const activas: number[] = [];
    const debilitadas: number[] = [];
    for (const regla of cfg.contexto) {
      const idxs = matchContexto(tokens, regla);
      if (!idxs) continue;
      const estados = idxs.map((i) => estadoEn(rangos, pos[i]));
      const nNeg = estados.filter((e) => e === "NEGADA").length;
      const nDeb = estados.filter((e) => e === "DEBILITADA").length;
      const nombre = `contexto:${regla.nombre}`;
      if (nNeg === idxs.length) {
        senales.push({ slug: cfg.slug, nombre, menciones: 1, estado: "NEGADA" });
        negadas.push(nombre);
      } else if (nNeg > 0 || nDeb > 0) {
        debilitadas.push(regla.peso);
        senales.push({ slug: cfg.slug, nombre, menciones: 1, estado: "DEBILITADA" });
        positivas.push(`${nombre} (debilitada)`);
      } else {
        activas.push(regla.peso);
        if (regla.peso >= PESO_SENAL_FUERTE) fuertes.add(cfg.slug);
        senales.push({ slug: cfg.slug, nombre, menciones: 1, estado: "POSITIVA" });
        positivas.push(nombre);
      }
    }
    // Tope por familia (sin doble conteo): varias reglas que premian el MISMO
    // hecho ("garantía+casa", "garantía+devolver") no suman linealmente.
    // score_familia = max(reglas) + 0,15 × (n−1), bonus acotado a 1 punto.
    const scoreFamilia = (pesos: number[]) =>
      pesos.length ? Math.max(...pesos) + Math.min(1, 0.15 * (pesos.length - 1)) : 0;
    puntos += scoreFamilia(activas) + scoreFamilia(debilitadas.map((p) => p * PESO_DEBILITADA));
    // Capa de anclas estructurales: marcadores del documento (tribunal con
    // nombre propio, formato de rol, escritura pública). No son hechos
    // narrados: la negación NO las anula. Tope 3 puntos por materia para que
    // dos anclas no inventen una materia sin relato.
    let puntosAnclas = 0;
    for (const anc of cfg.anclas) {
      const flags = anc.re.flags.includes("g") ? anc.re.flags : anc.re.flags + "g";
      const re = new RegExp(anc.re.source, flags);
      const mm = t.match(re);
      if (mm && mm.length) {
        puntosAnclas += mm.length * anc.peso;
        senales.push({ slug: cfg.slug, nombre: anc.nombre, menciones: mm.length, estado: "POSITIVA" });
        positivas.push(`${anc.nombre} x${mm.length}`);
      }
    }
    puntos += Math.min(puntosAnclas, TOPE_ANCLAS);
    if (puntosAnclas > 0) fuertes.add(cfg.slug);
    // Fase I: aporte de los términos ambiguos desambiguados por oración
    // (multa→civil/transito/laboral/administrativo según vecinos, etc.).
    puntos += amb.puntos.get(cfg.slug) ?? 0;
    // Fase I: menciones ambiguas NEGADAS ("no existe multa municipal") cuentan
    // como negación de la materia que sus vecinos revelaban: no suman y la
    // materia no puede ganar por corpus con esa señal anulada.
    for (const n of amb.negadas) {
      if (n.slug === cfg.slug) negadas.push(`${n.nombre} x${n.menciones}`);
    }
    if (negadas.length) {
      negaciones.push(`${MATERIAS[cfg.slug].nombre}: ${negadas.join(", ")} (negado en el texto: no suma)`);
      if (puntos > 0) {
        conflictos.push(`${MATERIAS[cfg.slug].nombre}: señales negadas (${negadas.join(", ")}) junto a señales positivas (${positivas.join(", ")}). Revisar el alcance de la negación.`);
      }
    }
    if (puntos > 0) puntosPorMateria.set(cfg.slug, puntos);
  }
  // Fase I: orden determinista — a puntos iguales, primero la materia con más
  // señales DIRECTAS fuertes (una señal nombrada pesa más que co-ocurrencias).
  const fd = (slug: SlugMateria) => fuertesDirectas.get(slug) ?? 0;
  const scores = Array.from(puntosPorMateria.entries())
    .map(([slug, puntos]) => ({ slug, puntos }))
    .sort((a, b) => b.puntos - a.puntos || fd(b.slug) - fd(a.slug));
  const desempateDirecto = !!(scores.length > 1
    && scores[0].puntos === scores[1].puntos
    && fd(scores[0].slug) > fd(scores[1].slug));
  if (!scores.length || scores[0].puntos < UMBRAL_PUNTOS) {
    return {
      ...vacio, senales, scores, negaciones, incumplimientos, conflictos,
      materiasFuertes: Array.from(fuertes),
      ambiguos: { evidencia: amb.evidencia, neutrales: amb.neutrales },
      desempateDirecto,
    };
  }
  const margen = scores.length > 1 ? scores[0].puntos - scores[1].puntos : scores[0].puntos;
  return {
    slug: scores[0].slug, scores, senales, margen, negaciones, incumplimientos, conflictos,
    materiasFuertes: Array.from(fuertes),
    ambiguos: { evidencia: amb.evidencia, neutrales: amb.neutrales },
    desempateDirecto,
  };
}

/** Puntos mínimos para que la detección imponga materia: una señal fuerte
 *  (peso 3) o la combinación equivalente. Con señales débiles o empate, la
 *  plataforma NO impone: usa el área declarada o declara indeterminada. */
const PUNTOS_MIN_DECISION = 3;

/** Soporte léxico de una materia calculado por BM25 sobre su corpus
 *  (src/server/materiaCorpus.ts). `cobertura` está normalizada en [0,1] con el
 *  IDF de la propia materia: NO es un score BM25 crudo ni una probabilidad. */
export interface SoporteCorpusMateria {
  slug: SlugMateria;
  /** proporción del peso IDF de la consulta cubierta por el mejor documento */
  cobertura: number;
  /** ficha que aportó la cobertura (evidencia auditable) */
  evidencia: string | null;
  /** nº de fichas del corpus de la materia */
  documentos: number;
}

/** Decisión final de materia para el pipeline. La plataforma decide con las
 *  señales del texto cuando son concluyentes; el área declarada es respaldo y
 *  desempate. La discrepancia se anota como conflicto visible (nunca bloqueo). */
export interface ResolucionMateria {
  slug: SlugMateria | null;      // materia que GOBIERNA la recuperación
  /** "corpus" = el regex/ventana se abstuvo y desempató el corpus.
   *  "llm" = Fase I: el determinista dudó y un LLM con salida JSON estructurada
   *  clasificó el relato (confianza y razones visibles en advertencia). */
  origen: "declarada" | "senales" | "corpus" | "indeterminada" | "llm";
  conflicto: string | null;      // anotación visible si declarada != señales
  /** [VERIFICAR] por señales débiles o empate de materias */
  advertencia: string | null;
  clasificacion: ClasificacionMateria;
  /** señales que la negación del texto anuló (evidencia visible) */
  negaciones: string[];
  /** segunda materia con señales reales (casos mixtos): se recupera su corpus
   *  como apoyo, pero NO gobierna el caso ni el plazos */
  materiaSecundaria: SlugMateria | null;
  /** cobertura BM25 normalizada de los candidatos (evidencia visible) */
  soporteCorpus?: SoporteCorpusMateria[];
}

/** Umbrales del corpus (Fase D.3). El corpus solo actúa cuando el regex/ventana
 *  NO decide: no puede inflar la confianza de una decisión ya tomada. */
const UMBRAL_CORPUS = 0.35;
const MARGEN_CORPUS = 0.10;

export function resolverMateria(
  areaDeclarada: string | null | undefined,
  texto: string,
  soporteCorpus?: SoporteCorpusMateria[],
): ResolucionMateria {
  const declarada = normalizarAreaDeclarada(areaDeclarada);
  const clas = clasificarMateria(texto);
  const detectada = clas.slug;
  const top = clas.scores[0]?.puntos ?? 0;
  const neg = clas.negaciones;
  // "no me pagaron el finiquito" NO anula la señal: es un incumplimiento
  // afirmado. Ambas notas salen juntas como evidencia en el prompt.
  const notaNegacion = (neg.length || clas.incumplimientos.length)
    ? `${neg.length ? ` Negación detectada: ${neg.join("; ")}.${clas.conflictos.length ? ` ${clas.conflictos.join("; ")}` : ""}` : ""}${clas.incumplimientos.length ? ` Incumplimientos afirmados (el hecho existe, la señal se mantiene): ${clas.incumplimientos.join("; ")}.` : ""}`
    : "";
  const advertenciaNegacion = neg.length ? `negacion_detectada:${notaNegacion}` : null;
  // Concluyente = hay una materia detectada, un primer lugar único (margen > 0
  // o empate roto por señales directas fuertes —Fase I) y al menos una señal
  // fuerte. Un empate real (margen 0 sin desempate) o solo señales débiles
  // (< 3 puntos) no bastan para que la plataforma imponga materia.
  const decidida = !!detectada && (clas.margen > 0 || clas.desempateDirecto) && top >= PUNTOS_MIN_DECISION;
  const conteo = (slug: SlugMateria) =>
    clas.senales.filter(x => x.slug === slug).map(x => `${x.nombre} x${x.menciones}`).join(", ");
  const notaDebil = (slug: SlugMateria) =>
    `señales débiles de "${MATERIAS[slug].nombre}" (${conteo(slug)}; ${top} puntos, margen ${clas.margen})`;
  // Casos mixtos: segunda materia con señales reales. Se recupera su corpus
  // como apoyo y se anota; no gobierna ni el caso ni los plazos.
  // Fase I: además de puntos, la secundaria exige evidencia FUERTE de esa
  // materia (señal peso>=3, contexto peso>=3 o ancla). Sin ella, el segundo
  // lugar es solo palabras genéricas repetidas ("demanda", "contrato") y NO
  // se reporta: eso fabricaba secundarias Tránsito/Penal fantasma.
  const secundaria: SlugMateria | null =
    detectada && clas.scores[1] && clas.scores[1].puntos >= UMBRAL_PUNTOS
      && clas.materiasFuertes.includes(clas.scores[1].slug)
      ? clas.scores[1].slug
      : null;
  const notaSecundaria = secundaria
    ? `materia_secundaria: el texto también muestra señales de "${MATERIAS[secundaria].nombre}" (${conteo(secundaria)}). Se recupera su corpus como apoyo; no gobierna el caso.`
    : null;

  // ── Corpus (Fase D.3): solo desempata cuando las señales se abstienen ─────
  // Una materia con TODAS sus señales negadas no puede ganar por corpus.
  const materiaNegada = (slug: SlugMateria) =>
    neg.some((n) => n.startsWith(`${MATERIAS[slug].nombre}:`)) &&
    !clas.scores.some((x) => x.slug === slug);
  const soporteValido = (soporteCorpus || [])
    .filter((s) => s.cobertura >= UMBRAL_CORPUS && !materiaNegada(s.slug))
    .sort((a, b) => b.cobertura - a.cobertura);
  const ganadorCorpus = soporteValido[0] ?? null;
  const margenCorpus = ganadorCorpus
    ? ganadorCorpus.cobertura - (soporteValido[1]?.cobertura ?? 0)
    : 0;
  const corpusDecide = !!ganadorCorpus && margenCorpus >= MARGEN_CORPUS;
  const notaCorpus = (s: SoporteCorpusMateria) =>
    `soporte_corpus: el corpus de "${MATERIAS[s.slug].nombre}" cubre ${s.cobertura.toFixed(2)} del peso del relato (ficha: ${s.evidencia ?? "sin ficha"}). Es una sugerencia léxica, no una probabilidad: confirma la materia.`;

  // Sin área declarada: decide la detección si hay una materia con margen > 0
  // (o empate roto por evidencia directa); si empata de verdad, desempata el
  // corpus; si tampoco, indeterminada (y el orquestador híbrido consulta el
  // respaldo LLM).
  if (!declarada) {
    if (detectada && (clas.margen > 0 || clas.desempateDirecto)) {
      return {
        slug: detectada,
        origen: "senales",
        conflicto: null,
        advertencia: decidida
          ? advertenciaNegacion
          : `materia_sugerida: la plataforma detectó "${MATERIAS[detectada].nombre}" solo por ${notaDebil(detectada)}. Confirma la materia antes de presentar.${notaNegacion}`,
        clasificacion: clas,
        negaciones: neg,
        materiaSecundaria: secundaria,
        soporteCorpus,
      };
    }
    if (corpusDecide) {
      return {
        slug: ganadorCorpus!.slug,
        origen: "corpus",
        conflicto: null,
        advertencia: notaCorpus(ganadorCorpus!) + notaNegacion,
        clasificacion: clas,
        negaciones: neg,
        materiaSecundaria: secundaria,
        soporteCorpus,
      };
    }
    return {
      slug: null,
      origen: "indeterminada",
      conflicto: null,
      advertencia: detectada
        ? `materia_ambigua: empate de señales (${clas.scores.map(x => `${MATERIAS[x.slug].nombre}=${x.puntos}`).join(", ")}). La plataforma no impone materia: confirma el área del caso.${notaNegacion}`
        : advertenciaNegacion,
      clasificacion: clas,
      negaciones: neg,
      materiaSecundaria: null,
      soporteCorpus,
    };
  }

  // Área declarada y sin señales: se respeta como respaldo. El corpus puede
  // anotar una discrepancia, pero no pisa el área declarada por sí solo.
  if (!detectada) {
    if (corpusDecide && ganadorCorpus!.slug !== declarada) {
      return {
        slug: declarada,
        origen: "declarada",
        conflicto: `conflicto_materia: el usuario declaró "${MATERIAS[declarada].nombre}" y el corpus sugiere "${MATERIAS[ganadorCorpus!.slug].nombre}" (cobertura ${ganadorCorpus!.cobertura.toFixed(2)}; ficha: ${ganadorCorpus!.evidencia ?? "sin ficha"}). Se mantiene la declarada — confirma la materia.`,
        advertencia: advertenciaNegacion,
        clasificacion: clas,
        negaciones: neg,
        materiaSecundaria: secundaria,
        soporteCorpus,
      };
    }
    return { slug: declarada, origen: "declarada", conflicto: null, advertencia: advertenciaNegacion, clasificacion: clas, negaciones: neg, materiaSecundaria: null, soporteCorpus };
  }

  // Declarada y detección coinciden: la plataforma confirma.
  if (detectada === declarada) {
    return {
      slug: declarada,
      origen: decidida ? "senales" : "declarada",
      conflicto: null,
      advertencia: decidida ? advertenciaNegacion : `${notaDebil(declarada)}; se mantiene el área declarada.${notaNegacion}`,
      clasificacion: clas,
      negaciones: neg,
      materiaSecundaria: secundaria,
    };
  }

  // Declarada != detectada. Si la detección es concluyente, la plataforma
  // decide y lo anota; si no, se mantiene la declarada con la discrepancia
  // visible para que el usuario confirme.
  if (decidida) {
    return {
      slug: detectada,
      origen: "senales",
      conflicto: `materia_decidida_por_plataforma: el usuario declaró "${MATERIAS[declarada].nombre}" pero las señales del texto son de "${MATERIAS[detectada].nombre}" (${conteo(detectada)}; ${top} puntos, margen ${clas.margen}). La plataforma decide "${MATERIAS[detectada].nombre}"; si el relato está incompleto, corrígelo.`,
      advertencia: advertenciaNegacion,
      clasificacion: clas,
      negaciones: neg,
      materiaSecundaria: secundaria,
    };
  }
  return {
    slug: declarada,
    origen: "declarada",
    conflicto: `conflicto_materia: el usuario declaró "${MATERIAS[declarada].nombre}" y el texto muestra señales de "${MATERIAS[detectada].nombre}" (${conteo(detectada)}), pero no son concluyentes (${top} puntos, margen ${clas.margen}). Se mantiene la declarada — confirma la materia.`,
    advertencia: advertenciaNegacion,
    clasificacion: clas,
    negaciones: neg,
    materiaSecundaria: secundaria,
  };
}

/** Línea de prompt honesta: materia que gobierna + quién la decidió + conteos
 *  crudos, sin porcentajes de confianza inventados. */
export function lineaMateriaPrompt(r: ResolucionMateria): string {
  const goberna = r.slug ? MATERIAS[r.slug].nombre : "indeterminada (sin señales suficientes)";
  const origen = r.origen === "senales"
    ? "decidida por la plataforma a partir de las señales del texto"
    : r.origen === "declarada"
      ? "declarada por el usuario (la plataforma no encontró señales concluyentes de otra materia)"
      : r.origen === "corpus"
        ? "sugerida por el corpus (BM25 normalizado) tras abstenerse las señales: requiere confirmación"
        : r.origen === "llm"
          ? "clasificada por el modelo de respaldo (JSON estructurado) tras abstenerse o empatar las señales deterministas"
          : "indeterminada (señales insuficientes o empatadas)";
  const detalle = r.clasificacion.scores.length
    ? ` Señales crudas: ${r.clasificacion.scores.map(x => `${MATERIAS[x.slug].nombre}=${x.puntos}`).join(", ")}.`
    : " Sin señales de materia en el texto.";
  const secundaria = r.materiaSecundaria && r.materiaSecundaria !== r.slug
    ? `\n[SECUNDARIA] ${r.materiaSecundaria ? MATERIAS[r.materiaSecundaria].nombre : ""}: señales secundarias reales; su corpus se recupera como apoyo, no gobierna el caso.`
    : "";
  const corpus = r.soporteCorpus?.length
    ? `\n[CORPUS] ${r.soporteCorpus.map(s => `${MATERIAS[s.slug].nombre}=${s.cobertura.toFixed(2)}${s.evidencia ? ` (${s.evidencia})` : ""}`).join(", ")}. Cobertura BM25 normalizada por materia: señal léxica, no probabilidad.`
    : "";
  const negacion = r.negaciones.length
    ? `\n[NEGACIÓN] ${r.negaciones.join("; ")}. No uses esos hechos como base de la materia ni del análisis.`
    : "";
  const incumplimientos = r.clasificacion.incumplimientos.length
    ? `\n[HECHO AFIRMADO] ${r.clasificacion.incumplimientos.join("; ")}.`
    : "";
  const ambiguos = r.clasificacion.ambiguos.neutrales.length
    ? `\n[TÉRMINOS NEUTROS] ${r.clasificacion.ambiguos.neutrales.join("; ")}. Esas palabras NO inclinan la materia por sí solas.`
    : "";
  return `MATERIA QUE GOBIERNA ESTE CASO: ${goberna} (${origen}).${detalle}${r.conflicto ? `\n[ANOTACIÓN] ${r.conflicto}` : ""}${secundaria}${corpus}${negacion}${incumplimientos}${ambiguos}${r.advertencia ? `\n[VERIFICAR] ${r.advertencia}` : ""}`;
}
