// plazosChile.ts — Fase 7: motor DETERMINISTA de plazos procesales chilenos.
// Los numeros que salen de aqui los consume el borrador/dictamen como dato
// calculado por codigo (reglas fijas, conteo dia a dia, feriados embebidos,
// tabla de emplazamiento 258/259 CPC). El LLM puede redactarlos, no calcularlos.
//
// Regla de honestidad: cada regla del REGISTRO lleva su fundamento. Si un
// escenario no esta contemplado, devolvemos ok:false con aviso [VERIFICAR]:
// jamas un numero silenciosamente equivoco.

// ─── Feriados Chile (ley 2.977 y modificaciones) ────────────────────────────
// FIJOS dia-mes. VARIABLES: Pascua (Meeus/Jones/Butcher) -> Viernes/Sabado Santo.
export const FERIADOS_FIJOS: [number, number, string][] = [
  [1, 1, "Año Nuevo"], [1, 5, "Día del Trabajo"], [21, 5, "Glorias Navales"],
  [16, 7, "Virgen del Carmen"], [15, 8, "Asunción"], [18, 9, "Primera Junta"],
  [19, 9, "Glorias del Ejército"], [8, 12, "Inmaculada Concepción"], [25, 12, "Navidad"],
  [24, 12, "Feriado judicial"], [31, 12, "Feriado judicial"],
];

function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

export function feriadosAnio(anio: number): Set<string> {
  const out = new Set<string>();
  const p = pascua(anio);
  out.add(claveDia(new Date(p.getTime() - 2 * 864e5))); // Viernes Santo
  out.add(claveDia(new Date(p.getTime() - 1 * 864e5))); // Sábado Santo
  for (const [dia, mes] of FERIADOS_FIJOS) out.add(claveIso(anio, mes, dia));
  return out;
}

function claveDia(d: Date): string {
  return claveIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function claveIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// ─── Días hábiles por materia ────────────────────────────────────────────────
// Civil (CPC art. 66): inhábiles sábado, domingo y feriados legales. La
// suspensión de plazos por feriado judicial de FEBRERO fue ELIMINADA por la
// Ley 20.774 (D.O. 04-09-2014, "Suprime feriado judicial"): su art. 2° N° 2
// eliminó el inciso segundo del art. 66 CPC y su art. 7° derogó toda
// referencia al feriado judicial de febrero; el CPC vigente (XML BCN
// idNorma=22740, verificado 2026-10-29) no menciona vacaciones judiciales en
// ningún artículo. El "feriado anual de un mes" (COT art. 313, texto según
// Ley 20.774) es variable por tribunal y auto acordado: no es modelable
// determinísticamente, queda cubierto por el marco [VERIFICAR]. Laboral y
// familia: nunca suspendieron en este motor.
export interface ReglaHabiles { feriados: boolean; vacacionesJudiciales: "si" | "no"; }
const HABILES: Record<"civil" | "laboral" | "familia", ReglaHabiles> = {
  civil: { feriados: true, vacacionesJudiciales: "no" }, // Ley 20.774: febrero ya no suspende
  laboral: { feriados: true, vacacionesJudiciales: "no" },
  familia: { feriados: true, vacacionesJudiciales: "no" },
};

export function esDiaHabil(fecha: Date, materia: keyof typeof HABILES): boolean {
  const dow = fecha.getUTCDay();
  if (dow === 0 || dow === 6) return false; // domingo y sábado
  const regla = HABILES[materia];
  const y = fecha.getUTCFullYear();
  if (regla.vacacionesJudiciales === "si" && fecha.getUTCMonth() + 1 === 2) return false;
  if (regla.feriados && feriadosAnio(y).has(claveDia(fecha))) return false;
  return true;
}

// ─── Tabla de emplazamiento (CPC arts. 258/259) ─────────────────────────────
// +2 días hábiles por cada 100 km de distancia o fracción superior a 50 km.
export function diasEmplazamiento(km: number): number {
  if (km <= 50) return 0;
  return 2 * Math.ceil((km - 50) / 100);
}

// Distancias referenciales (km) desde Santiago, por región. Si la comuna del
// demandado difiere de la capital regional, el resultado lleva [VERIFICAR].
export const KM_REGION_SANTIAGO: Record<string, number> = {
  "arica y parinacota": 1850, "tarapaca": 1700, "antofagasta": 1350,
  "atacama": 850, "coquimbo": 480, "valparaiso": 110, "metropolitana": 0,
  "ohiggins": 90, "maule": 270, "nuble": 400, "biobio": 500,
  "araucania": 680, "los rios": 850, "los lagos": 1030,
  "aysen": 1770, "magallanes": 2800,
};

// ─── Registro de plazos (cada uno con su fundamento) ─────────────────────────
export interface PlazoEmpateDef {
  id: string;
  descripcion: string;
  materia: keyof typeof HABILES;
  diasHabiles: number;
  emplazamiento: boolean;   // aplica tabla 258/259?
  fundamento: string;
}
export const PLAZOS: PlazoEmpateDef[] = [
  {
    id: "civil_contestacion",
    descripcion: "Plazo para contestar demanda civil ordinaria",
    materia: "civil", diasHabiles: 15, emplazamiento: true,
    fundamento: "CPC art. 258 (notificación) y arts. 258/259 (emplazamiento). No se suspende en febrero (Ley 20.774, D.O. 04-09-2014).",
  },
  {
    id: "laboral_contestacion",
    descripcion: "Plazo para contestar demanda laboral",
    materia: "laboral", diasHabiles: 15, emplazamiento: true,
    fundamento: "CT art. 446 (15 días hábiles, con tabla de emplazamiento).",
  },
  {
    id: "civil_apelacion_auto",
    descripcion: "Apelación de resoluciones interlocutorias en civil",
    materia: "civil", diasHabiles: 5, emplazamiento: false,
    fundamento: "CPC art. 107 Nº 2 (5 días hábiles). No se suspende en febrero (Ley 20.774, D.O. 04-09-2014).",
  },
  {
    id: "civil_oposicion_medida",
    descripcion: "Oposición a la ejecución de medida (cump. ejecución civil)",
    materia: "civil", diasHabiles: 3, emplazamiento: false,
    fundamento: "CPC art. 486 Nº 3 (3 días hábiles para la oposición). No se suspende en febrero (Ley 20.774, D.O. 04-09-2014).",
  },
  {
    id: "familia_apelacion",
    descripcion: "Apelación de resoluciones en familias",
    materia: "familia", diasHabiles: 5, emplazamiento: false,
    fundamento: "Ley 19.968 art. 51 (5 días hábiles).",
  },
  {
    id: "laboral_apelacion",
    descripcion: "Apelación de resoluciones en laboral",
    materia: "laboral", diasHabiles: 5, emplazamiento: false,
    fundamento: "CT art. 533 (5 días hábiles).",
  },
];

export interface EntradaPlazoP {
  plazoId: string;              // debe existir en PLAZOS
  fechaNotificacion: string;    // ISO "YYYY-MM-DD"
  kmDemandado?: number | null;  // distancia por 258/259; null/0 = misma comuna
}
export interface ResultadoPlazo {
  ok: boolean;
  plazoId: string;
  fuente: string;
  fechaLimite?: string;
  diasOtorgados?: number;
  desglose?: string[];
  aviso?: string;               // [VERIFICAR ...] cuando el dato queda estimado
  vencido?: boolean;            // Fase 6-calibración: fechaLimite < hoy (anotación, jamás bloqueo)
}

export function existePlazo(id: string): boolean {
  return PLAZOS.some((p) => p.id === id);
}

export function calcularPlazo(entrada: EntradaPlazoP): ResultadoPlazo {
  const def = PLAZOS.find((p) => p.id === entrada.plazoId);
  if (!def) return { ok: false, plazoId: entrada.plazoId, fuente: "plazo-invalido", aviso: "[VERIFICAR: plazo no contemplado en el motor]" };
  const notif = new Date(`${entrada.fechaNotificacion}T00:00:00Z`);
  if (isNaN(notif.getTime())) return { ok: false, plazoId: entrada.plazoId, fuente: "fecha-invalida", aviso: "[VERIFICAR: fecha de notificación sin formato ISO]" };

  let extra = 0;
  let kmUsado: number | null = null;
  const desglose: string[] = [
    `Notificación: ${entrada.fechaNotificacion} (CPC art. 251: el plazo corre desde el día siguiente de transcurridas 24 horas).`,
  ];
  if (def.emplazamiento) {
    kmUsado = entrada.kmDemandado == null ? 0 : entrada.kmDemandado;
    extra = diasEmplazamiento(kmUsado);
    desglose.push(`Emplazamiento (arts. 258/259): +${extra} días hábiles por ${kmUsado} km.` + (entrada.kmDemandado == null ? " [VERIFICAR: distancia según comuna del demandado; sin dato se asume misma comuna]" : ""));
  }

  const total = def.diasHabiles + extra;
  const regla = HABILES[def.materia];
  const anioFin = notif.getUTCFullYear() + 2; // margen de seguridad
  let fechaIter = new Date(notif.getTime() + 24 * 60 * 60 * 1000); // art. 251
  let diasCuenta = 0;
  let limite: Date | null = null;
  while (diasCuenta < total) {
    if (fechaIter.getUTCFullYear() > anioFin) break;
    const dow = fechaIter.getUTCDay();
    const hab = dow !== 0 && dow !== 6
      && !(regla.vacacionesJudiciales === "si" && fechaIter.getUTCMonth() + 1 === 2)
      && !feriadosAnio(fechaIter.getUTCFullYear()).has(claveDia(fechaIter));
    if (hab) diasCuenta++;
    if (diasCuenta < total) fechaIter = new Date(fechaIter.getTime() + 24 * 60 * 60 * 1000);
    else limite = fechaIter;
  }
  if (!limite) return { ok: false, plazoId: entrada.plazoId, fuente: "sin-fecha-limite", aviso: "[VERIFICAR: no se consinto fecha limite dentro del margen anual]" };

  desglose.push(`Días hábiles computados: ${total} (${def.diasHabiles} base${extra ? ` + ${extra} emplazamiento` : ""}).`);
  desglose.push(`Inhábiles aplicados: sábado/domingo + feriados${regla.vacacionesJudiciales === "si" ? " + vacaciones judiciales (febrero)" : ""}.`);

  return {
    ok: true,
    plazoId: def.id,
    fuente: def.fundamento,
    fechaLimite: claveDia(limite),
    diasOtorgados: total,
    desglose,
    // Calibración gate: anotar vencido. Contraste fecha-ISO lexicográfico
    // (claveIso siempre YYYY-MM-DD) — determinista, sin zonas horarias.
    vencido: claveDia(limite) < hoyIso(),
  };
}

/** "YYYY-MM-DD" de hoy en UTC (igual clave que claveDia/claveIso del motor). */
export function hoyIso(): string {
  return claveDia(new Date());
}

// ─── Detección de fecha de notificación en el texto del caso ────────────────
const MESES_NOTIF: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

export interface FechasNotificacionResultado {
  fechas: string[];        // todas las fechas de notificación detectadas, en orden del texto
  primera: string | null;  // la que el motor usa (compatible con detectarFechaNotificacion)
  ambigua: boolean;        // >= 2 fechas DISTINTAS: el relato no permite saber cuál corre el plazo
}

/** Recolecta TODAS las fechas en las cláusulas "notificada/os" (formato textual
 *  y numérico), en orden del texto. Cada mención abre una ventana de ~200 chars
 *  donde pueden caer varias fechas ("el 5 de mayo ... y con cédula el 19 de
 *  mayo"): eso ES ambigüedad. Duplicados de la MISMA fecha no lo son. */
export function detectarFechasNotificacion(texto: string): FechasNotificacionResultado {
  const vacio: FechasNotificacionResultado = { fechas: [], primera: null, ambigua: false };
  if (!texto) return vacio;
  const t = texto.toLowerCase().slice(0, 6000)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // sin tildes: "septiembre"/"marzo" robusto
  const meses: Record<string, number> = {};
  for (const k of Object.keys(MESES_NOTIF)) meses[k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")] = (MESES_NOTIF as any)[k];
  const hallazgos: Array<{ iz: number; iso: string | null }> = [];
  // "notificada/os" y "notificación" (la sustantiva es habitual en la práctica:
  // "la notificación de la demanda se practicó el ...").
  const NOTIFICAD_RE = /notificad[oa]s?|notificacion\b/g;
  let nm: RegExpExecArray | null;
  while ((nm = NOTIFICAD_RE.exec(t)) !== null) {
    const izCl = nm.index;
    // Cosecha HASTA el fin de oración (punto o salto) para no arrastrar fechas
    // ajenas de la oración siguiente (fecha de contrato, audiencia, etc.).
    let fin = izCl;
    while (fin < t.length && t[fin] !== "." && t[fin] !== "\n" && t[fin] !== ";" && fin - izCl < 250) fin++;
    const ventana = t.slice(izCl, fin) + " ";
    // textual: "el 12 de marzo de 2024"
    const rxTexto = /(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/g;
    let m: RegExpExecArray | null;
    while ((m = rxTexto.exec(ventana)) !== null) {
      const mes = meses[m[2]];
      const dia = Number(m[1]);
      if (mes && dia >= 1 && dia <= 31) {
        hallazgos.push({ iz: izCl + m.index, iso: claveIso(Number(m[3]), mes, dia) });
        continue;
      }
    }
    // numérico: "3/4/2024" o "3-4-2024"
    const rxNum = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g;
    while ((m = rxNum.exec(ventana)) !== null) {
      let a = Number(m[3]);
      if (a < 100) a += 2000;
      const mes = Number(m[2]);
      const dia = Number(m[1]);
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        hallazgos.push({ iz: izCl + m.index, iso: claveIso(a, mes, dia) });
      }
    }
  }
  hallazgos.sort((a, b) => a.iz - b.iz);
  const enOrden: string[] = [];
  for (const h of hallazgos) if ((h.iso ?? "") && !enOrden.includes(h.iso as string)) enOrden.push(h.iso as string);
  return { fechas: enOrden, primera: enOrden[0] || null, ambigua: enOrden.length >= 2 };
}

/** Compat: equivale a detectarFechasNotificacion(texto).primera */
export function detectarFechaNotificacion(texto: string): string | null {
  return detectarFechasNotificacion(texto).primera;
}

// ─── Cross-check: ¿el borrador consigna la fecha límite del motor? ──────────
// Enforcement de ANOTACIÓN (decisión Fase 7: los borradores gratuitos no
// bloquean). Detecta la fecha límite en cualquier formato razonable; si no
// aparece en ningún formato, devuelve nota que lo advierte. Numeros que SALen
// del motor: el LLM ya no puede cambiarlos sin que se note.
const MESES_NOMBRE = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function fmtFechaChilena(iso: string): { canonico: string; variantes: string[] } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { canonico: iso, variantes: [iso] };
  const [_, y, mm, dd] = m;
  const nombre = MESES_NOMBRE[Number(mm) - 1];
  const diaNum = String(Number(dd));
  const variantes = [
    iso,
    `${dd}-${mm}-${y}`,
    `${dd}/${mm}/${y}`,
    `${diaNum} de ${nombre} de ${y}`,
    `${diaNum} de ${nombre} del ${y}`,
  ];
  return { canonico: variantes[3], variantes };
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export interface ChequeoPlazoMotor { ok: boolean; plazoId: string; fechaLimite: string; consignado: boolean; vencido?: boolean; }

export function chequearPlazosEnBorrador(calculos: ResultadoPlazo[], draft: string): ChequeoPlazoMotor[] {
  const dNorm = sinTildes(typeof draft === "string" ? draft : "");
  return calculos.filter((c) => c.ok && c.fechaLimite).map((c) => {
    const variantes = fmtFechaChilena(c.fechaLimite as string).variantes.map(sinTildes);
    const consignado = variantes.some((v) => dNorm.includes(v));
    return { ok: true, plazoId: c.plazoId, fechaLimite: c.fechaLimite as string, consignado, vencido: c.vencido === true };
  });
}

// ─── Anotaciones de plazos (capa warn del gate híbrido) ──────────────────────
// Determinista y pura: recibe el resultado del motor + el borrador/informe y
// devuelve las advertencias visibles. NUNCA bloquea (decisión Fase 7).
export function anotacionesPlazos(calculos: ResultadoPlazo[], escrito: string, fechas: FechasNotificacionResultado): string[] {
  const out: string[] = [];
  if (fechas.ambigua) {
    out.push(`fecha_notificacion_ambigua: el relato menciona ${fechas.fechas.length} fechas de notificación distintas (${fechas.fechas.join(", ")}); el motor usó la primera (${fechas.primera}). Confirmar cuál computa.`);
  }
  for (const p of calculos) {
    if (p.vencido === true && p.fechaLimite) out.push(`plazo_vencido: el límite ${p.fechaLimite} (${p.plazoId}) es anterior a hoy.`);
  }
  for (const c of chequearPlazosEnBorrador(calculos, escrito)) {
    if (!c.consignado && c.vencido !== true) {
      const f = c.fechaLimite;
      out.push(`limite_no_consignada: el motor calculó la fecha límite ${f} (${c.plazoId}) y el escrito no la consigna en ningún formato — confírmala contra el desglose antes de presentar.`);
    }
  }
  return out;
}

// ─── Bloque para el prompt del borrador ──────────────────────────────────────
export function bloquePromptPlazos(calculos: ResultadoPlazo[]): string {  const ok = calculos.filter((c) => c.ok);
  if (!ok.length) return "";
  let s = "\n\nPLAN DE PLAZOS (MOTOR DETERMINISTA plazosChile.ts — calculado por código, NO por estimación tuya):\n";
  s += "ESTA FECHA ES UN DATO DEL MOTOR, NO UNA ESTIMACIÓN. Reutilízala literal; si el caso menciona datos que la contradicen, prioriza el desglose del motor y consígignala con [DATO FALTANTE: confirmar fecha de notificación].\n";
  for (const c of ok) {
    s += `\n[PLAZO ${c.plazoId}] límite: ${c.fechaLimite} (${c.diasOtorgados} días hábiles).\nFundamento: ${c.fuente}\n${(c.desglose || []).join(" ")}\n`;
  }
  return s;
}
