// Control táctico determinista del borrador (sin IA, sin red, sin DB).
// Por qué existe: en un caso real el modelo redactó DENTRO de una DEMANDA
// fórmulas propias de la contestación — "ha procedido o procederá a la
// regularización y pago ... con el objeto de convalidar el despido" (prometer
// pagos futuros en la Ley Bustos habilita la nulidad del despido) y "se allana
// al pago de las sumas que ... pudieren corresponder ... si es que existiere
// algún saldo" (allanamiento "por si acaso" que entrega una victoria fácil).
// Este módulo detecta esas fórmulas en el texto YA generado y las anota de
// forma visible con la fórmula correcta. JAMÁS bloquea ni reescribe (misma
// política que plazos y vacíos): la corrección es decisión del profesional.
//
// matching: se normaliza (minúsculas + sin acentos) preservando el largo del
// string, de modo que los índices sirvan para extraer la frase exacta del
// texto original.

import type { DraftTipo, DraftPostura, HallazgoTactico } from "./src/types.js";

export interface ContextoTactico {
  tipo: DraftTipo;
  /** Postura procesal declarada; null = no indicada (el servidor la deriva del tipo). */
  postura?: DraftPostura | null;
  /** true cuando el motor determinista de plazos calculó que el plazo está vencido (fechaLimite < hoy). */
  plazoVencido?: boolean;
}

type Severidad = "critico" | "alto" | "medio";

interface ReglaTactica {
  id: string;
  severidad: Severidad;
  /** Regex GLOBAL sobre texto normalizado (sin acentos, minúsculas). */
  re: RegExp;
  /** Si definida, la keyword debe aparecer en la ventana ±RADIO alrededor del match. */
  ventana?: RegExp;
  /** Excluye el match si este patrón calza justo ANTES del match (p.ej. "no " para "no se allana"). */
  excluirAntes?: RegExp;
  aplica: (ctx: ContextoTactico) => boolean;
  regla: string;
  reemplazo: string;
}

const RADIO = 160;

const REGLAS: ReglaTactica[] = [
  // ── LEY BUSTOS: prohibido prometer pagos o regularización futura ───────────
  {
    id: "bustos_futuro",
    severidad: "critico",
    re: /(?:ha\s+procedido\s+o\s+)?proceder[ae]\s+a\s+(?:la\s+)?(?:regularizaci[oó]n|regularizar|pago|pagar|enterar|enteramiento|solventar|solventaci[oó]n|subsanar|subsanaci[oó]n)|con\s+el\s+(?:objeto|fin|prop[oó]sito)\s+de\s+convalidar|convalidar[ae]\s+el\s+despido|se\s+convalidar[ae]\b|quedar[ae]\s+convalidad[oa]|una\s+vez\s+(?:pagad|enterad|regularizad|solventad)[oa]s?\b|se\s+(?:regularizar[ae]|enterar[ae]|solventar[ae])\b|(?:mi\s+representad[oa]|esta\s+parte|la\s+demandada|el\s+demandado|el\s+empleador(?:a)?)\s*(?:ha\s+procedido\s+o\s+)?(?:se\s+)?(?:pagar[ae]|regularizar[ae]|enterar[ae])/g,
    ventana: /cotizaci|previsional|nulidad|bustos|feriado|despido|adeud|impag/,
    aplica: () => true,
    regla: "PROHIBIDO prometer pagos o regularización futura de cotizaciones (Ley Bustos, art. 162 CT): reconocer que se 'procederá' a pagar confirma el impago al despido y habilita la nulidad de pleno derecho por todo el período.",
    reemplazo:
      "Si consta pago íntegro Y notificación (fecha cierta + prueba): «La nulidad del despido se encuentra íntegramente convalidada con fecha [X], mediante pago íntegro de las cotizaciones adeudadas y notificación fehaciente al trabajador y a la Inspección del Trabajo, por lo que la sanción carece de objeto actual». Si NO consta: «Se niega que las cotizaciones previsionales se encontraran impagas al momento del despido, debiendo la demandante acreditar ese presupuesto con certificados de cotización y registros de la AFP/institución respectiva». Nunca en futuro, nunca como finalidad.",
  },
  {
    id: "bustos_sin_fecha",
    severidad: "alto",
    re: /\bconvalidad[oa]\b/g,
    aplica: () => true,
    // validación especial dentro del matching (fecha + notificación en ventana)
    regla: "Alegar convalidación exige PASADO, FECHA CIERTA y prueba del pago y de la notificación (al trabajador y a la Inspección del Trabajo).",
    reemplazo:
      "«...se encuentra íntegramente convalidada con fecha [X], mediante pago íntegro y notificación fehaciente al trabajador y a la Inspección del Trabajo...». Si no hay fecha/prueba en el expediente, usa la negación del presupuesto: «Se niega que las cotizaciones estuvieran impagas al momento del despido».",
  },
  {
    id: "bustos_admision",
    severidad: "critico",
    re: /\b(?:reconozco|reconocemos|reconoce|reconocen)(?:\s+expresamente)?\s+que\s+(?:las\s+|los\s+|la\s+|el\s+)?(?:cotizaciones|cotizaci[oó]n|aportes|previsionales?)[^.!?]{0,140}\b(?:impagas?|adeudad[oa]s?|pendientes?|no\s+(?:fueron|fue|han|ha)\s+(?:pagad|enterad)[oa]s?)|\b(?:cotizaciones|aportes|previsionales?)[^.!?]{0,100}\b(?:impagas?|adeudad[oa]s?)\b[^.!?]{0,140}\b(?:mi\s+representad[oa]|esta\s+parte)\s+reconoce/g,
    aplica: () => true,
    regla: "RECONOCER cotizaciones impagas al despido en el escrito habilita la nulidad de pleno derecho (Ley Bustos, art. 162 CT): el juez lo tiene para condenar sin más análisis.",
    reemplazo:
      "Niega el presupuesto: «Se niega que las cotizaciones previsionales se encontraran impagas al momento del despido», y exige a la contraria la prueba (certificados de cotización, registros). Si ya pagaste y notificaste, alega la convalidación con fecha y prueba.",
  },
  // ── ALLANAMIENTO: prohibido "por si acaso" o en abstracto ──────────────────
  {
    id: "allanamiento",
    severidad: "critico",
    re: /\b(?:se\s+)?allan(?:a|ar[ae]|arse|ando)\b|\ballanamiento\b/g,
    excluirAntes: /\b(?:no|sin)\s+(?:se\s+)?$/,
    aplica: () => true,
    // "allanamiento" (sustantivo) solo importa en contexto de pago/pretensión;
    // las formas verbales en presente/futuro son voz propia del que defiende.
    ventana: /pago|pagar|sumas|pretensi|demanda|saldo|adeud|cobro|feriado|monto|condena/,
    regla: "PROHIBIDO allanarse \"por si acaso\" o en abstracto: un allanamiento genérico reconoce la obligación y regala el resultado, aunque la contraria haya mal calculado o pidiera períodos ya gozados/finiquitados.",
    reemplazo:
      "Solo se reconoce una suma líquida, cierta e indiscutida, identificada por monto y concepto. Para feriado: «Se niega que el actor mantenga saldo alguno por concepto de feriado proporcional y/o legal, debiendo este acreditar fehacientemente mediante liquidaciones y registros que prestó servicios efectivos sin hacer uso de su feriado legal durante los períodos reclamados».",
  },
  {
    id: "feriado_hedge",
    severidad: "alto",
    re: /pudier(?:e|en)\s+(?:corresponder|adeudar|existir)|si\s+(?:es\s+que\s+)?existier[ae]\s+(?:alg[uú]n|un|una)\s+saldo|en\s+cuanto\s+pudier[ae]\s+(?:corresponder|adeudar)|por\s+si\s+acaso/g,
    ventana: /feriado|vacacion|saldo|sumas|adeud|pago|descanso|pretensi/,
    aplica: () => true,
    regla: "Lenguaje de cobertura procesal («pudieren corresponder», «si existiere algún saldo», «por si acaso»): en un juicio laboral equivale a reconocer la obligación sin límite de monto ni período.",
    reemplazo:
      "Niega el saldo y fija la carga de la prueba: «Se niega que el actor mantenga saldo alguno..., debiendo este acreditar fehacientemente mediante liquidaciones y registros...». Ofrece además tu prueba propia (registro de asistencia, comprobantes de feriado, finiquito) si el expediente la tiene.",
  },
  // ── POSTURA INVERTIDA: fórmulas de la vereda contraria ────────────────────
  {
    id: "postura_demanda",
    severidad: "critico",
    re: /excepciones?\s+previas?|negativa\s+de\s+hechos|defensas?\s+de\s+fondo|contestaci[oó]n\s+de\s+demanda|(?:se\s+niega|negamos|niegan|esta\s+parte\s+niega|mi\s+representad[oa]\s+niega)\s+que\s+el\s+actor/g,
    aplica: (ctx) => ctx.tipo === "demanda" || ctx.postura === "demandante",
    regla: "INVERSIÓN DE POSTURA: el tipo solicitado es DEMANDA (voz de la parte demandante). «Excepciones previas», «negativa de hechos», «defensas de fondo» y «se niega que el actor» pertenecen a la CONTESTACIÓN.",
    reemplazo:
      "Reescribe en voz de demandante (hechos, derecho y petitorio propio). Si en realidad representas al demandado, el tipo correcto del escrito es CONTESTACIÓN: regenera con ese tipo.",
  },
  {
    id: "postura_contestacion",
    severidad: "critico",
    re: /vengo\s+en\s+demandar|\bdemando\s+a\s+(?:la|el|los|las)\b|solicito\s+(?:que\s+)?se\s+condene\s+a\s+la\s+demandada\b/g,
    aplica: (ctx) => ctx.tipo === "contestacion" || ctx.postura === "demandado",
    regla: "INVERSIÓN DE POSTURA: el tipo solicitado es CONTESTACIÓN (voz de la parte demandada). Las fórmulas de demanda («vengo en demandar», «solicito se condene») no corresponden.",
    reemplazo:
      "Reescribe en voz de demandada (negativa por numerales, defensas y petitorio de rechazo). Las pretensiones de la contraria se citan para rebatirlas, nunca se formulan como propias.",
  },
  // ── PLAZO VENCIDO Y ERRORES PROCESALES CIVILES / MONITORIOS ────────────────
  {
    id: "plazo_vencido_afirmado",
    severidad: "critico",
    re: /encontrandome\s+dentro\s+de\s+plazo(?:\s+legal)?|dentro\s+de(?:l)?\s+plazo\s+legal|en\s+tiempo\s+y\s+forma/g,
    aplica: (ctx) => ctx.plazoVencido === true,
    regla: "PLAZO VENCIDO SEGÚN EL MOTOR: el escrito afirma estar «dentro de plazo legal» o «en tiempo y forma», pero con la fecha de notificación detectada el plazo ya venció.",
    reemplazo:
      "Verifica de inmediato el estampado del receptor en la OJV. Si la fecha de notificación es correcta y el plazo venció, elimina «dentro de plazo» y evalúa incidente de nulidad de lo obrado por falta de emplazamiento (art. 80 CPC) o fuerza mayor (art. 79 CPC).",
  },
  {
    id: "cpc_254_en_contestacion",
    severidad: "alto",
    re: /\bart(?:iculos?|s?\.?)\s*254\b/g,
    ventana: /procedimiento\s+civil|\bcpc\b|contestar|oposicion/,
    aplica: (ctx) => ctx.tipo === "contestacion" || ctx.postura === "demandado",
    regla: "Cita impertinente del Art. 254 del CPC en una contestación u oposición: el Art. 254 regula los requisitos de la DEMANDA, no de la contestación ni de la oposición.",
    reemplazo:
      "En contestación civil ordinaria cita el Art. 309 del CPC; en oposición monitoria de arrendamiento cita los Arts. 18-F y 18-H de la Ley N° 18.101 (y Art. 309 CPC en lo supletorio); en juicio ejecutivo cita los Arts. 459, 462 y 464 del CPC.",
  },
  {
    id: "monitorio_petitorio_requerimiento",
    severidad: "alto",
    re: /denegar\s+la\s+solicitud\s+de\s+requerimiento\s+de\s+pago/g,
    aplica: () => true,
    regla: "En el procedimiento monitorio de arrendamiento (Ley 18.101 art. 18-C), el requerimiento de pago ya fue dictado y notificado: no se pide «denegar la solicitud de requerimiento» retroactivamente.",
    reemplazo:
      "Pide: «Tener por interpuesta oposición fundada a la demanda monitoria; declarar terminado el procedimiento monitorio dejando sin efecto de pleno derecho la resolución del artículo 18-C de la Ley N° 18.101 (artículo 18-H); y rechazar el cobro en lo que exceda lo efectivamente adeudado, sin lugar al lanzamiento».",
  },
  {
    id: "calificativos_forenses",
    severidad: "medio",
    re: /maliciosamente\s+exigid[oa]s?|manifiesta\s+falta\s+de\s+fundamento|de\s+manera\s+integra\s+e\s+imprevista|\badude\b|\badudar\b/g,
    aplica: () => true,
    regla: "Lenguaje forense impropio o error léxico («maliciosamente exigidos», «íntegra e imprevista», «adude»): resta sobriedad técnica al escrito.",
    reemplazo:
      "Usa lenguaje técnico neutro («íntegra y oportuna», «adeudo/adeudar», «cobro improcedente por carecer de causa contractual», «con costas»).",
  },
];

// Normaliza preservando el largo (los índices del texto normalizado valen para
// el original): minúsculas + NFD + sin combining marks. "á" (1 char) -> "a"
// (1 char); "ñ" -> "n".
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const RE_FECHA = /\b\d{1,2}\s+de\s+[a-z]+\s+(?:de\s+)?\d{4}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
const RE_NOTIFICACION = /notif|inspeccion del trabajo|inspeccion comunal del trabajo|carta(?:[^\n]{0,40})?notific/;

function fraseOriginal(texto: string, ini: number, fin: number): string {
  // Expande a los bordes de la oración (o a 160 chars) y recorta en límites de palabra.
  const a = Math.max(0, ini - 160);
  const b = Math.min(texto.length, fin + 160);
  let start = ini;
  for (let i = ini - 1; i >= a; i--) {
    const ch = texto[i];
    if (ch === "\n" || ch === "." || ch === "!" || ch === "?" || ch === ";") { start = i + 1; break; }
    if (ini - i > 160) { start = i + 1; break; }
    start = i;
  }
  let end = fin;
  for (let i = fin; i < b; i++) {
    const ch = texto[i];
    if (ch === "\n" || ch === "." || ch === "!" || ch === "?" || ch === ";") { end = i; break; }
    if (i - fin > 160) { end = i; break; }
    end = i + 1;
  }
  const frase = texto.slice(start, end).replace(/\s+/g, " ").trim();
  return frase.length > 240 ? frase.slice(0, 237) + "…" : frase;
}

/** Detecta fórmulas tácticas prohibidas. Puro: sin red, sin IA, sin DB. */
export function lintTactico(texto: string, contexto: ContextoTactico): HallazgoTactico[] {
  if (!texto || !texto.trim()) return [];
  const norm = normalizar(texto);
  const brutos: Array<{ regla: ReglaTactica; ini: number; fin: number }> = [];

  for (const regla of REGLAS) {
    if (!regla.aplica(contexto)) continue;
    regla.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regla.re.exec(norm)) !== null) {
      const ini = m.index;
      const fin = ini + m[0].length;
      // Excepción "no se allana" / "sin allanarse"
      if (regla.excluirAntes && regla.excluirAntes.test(norm.slice(Math.max(0, ini - 12), ini))) {
        continue;
      }
      // Ventana de contexto (keyword cerca del match)
      if (regla.ventana) {
        const antes = norm.slice(Math.max(0, ini - RADIO), ini);
        const despues = norm.slice(fin, fin + RADIO);
        if (!regla.ventana.test(antes) && !regla.ventana.test(despues)) continue;
      }
      // Regla especial bustos_sin_fecha: solo si falta fecha o notificación cerca
      if (regla.id === "bustos_sin_fecha") {
        const antes = norm.slice(Math.max(0, ini - 220), ini);
        const despues = norm.slice(fin, fin + 220);
        const cerca = antes + " " + despues;
        if (RE_FECHA.test(cerca) && RE_NOTIFICACION.test(cerca)) continue;
        // doble reporte por la misma frase: una sola anotación
        brutos.push({ regla, ini, fin });
        continue;
      }
      brutos.push({ regla, ini, fin });
    }
  }

  // Dedupe por solapamiento (gana severidad mayor; a igualdad, el primero).
  const orden = { critico: 0, alto: 1, medio: 2 } as const;
  brutos.sort((x, y) => x.ini - y.ini || orden[x.regla.severidad] - orden[y.regla.severidad]);
  const elegidos: Array<{ regla: ReglaTactica; ini: number; fin: number }> = [];
  for (const h of brutos) {
    if (elegidos.some((e) => h.ini < e.fin && e.ini < h.fin)) continue;
    elegidos.push(h);
  }

  const detectados: HallazgoTactico[] = elegidos.map((h) => ({
    id: h.regla.id,
    severidad: h.regla.severidad,
    frase: fraseOriginal(texto, h.ini, h.fin),
    regla: h.regla.regla,
    reemplazo: h.regla.reemplazo,
  }));
  // Una alerta por regla: repetir "dentro de plazo" tres veces no requiere
  // tres tarjetas idénticas. La frase completa queda en el primer hallazgo.
  const idsVistos = new Set<string>();
  const resultado = detectados.filter((h) => {
    if (idsVistos.has(h.id)) return false;
    idsVistos.add(h.id);
    return true;
  });

  // Chequeo estructural para Oposición Monitoria de Arrendamiento (Ley 18.101 art. 18-F):
  // exige indicar en el mismo escrito todos los demás medios de prueba (testimonial,
  // pericial, etc.) de que se valdrá en el juicio declarativo posterior.
  if (
    (contexto.tipo === "contestacion" || contexto.postura === "demandado") &&
    /monitori[oa]s?/.test(norm) &&
    /(?:18\.?101|21\.?461|arrendamiento)/.test(norm) &&
    !/\b(?:prueba\s+)?(?:testimonial|pericial|confesional|inspeccion\s+personal)\b/.test(norm)
  ) {
    resultado.push({
      id: "monitorio_sin_medios_prueba",
      severidad: "alto",
      frase: "PRIMER OTROSÍ: ACOMPAÑA DOCUMENTOS (sin anuncio de demás medios de prueba para el juicio declarativo)",
      regla: "El Art. 18-F inciso 1° de la Ley N° 18.101 exige que en la oposición monitoria el deudor acompañe los documentos E INDIQUE TODOS LOS DEMÁS MEDIOS DE PRUEBA de que se valdrá en el juicio declarativo posterior (en el nuevo procedimiento no podrá producir ni ofrecer otros).",
      reemplazo:
        "Agrega un otrosí de medios de prueba: «OTROSÍ: De conformidad con el artículo 18-F de la Ley N° 18.101, vengo en señalar que en el juicio declarativo posterior esta parte se valdrá de todos los medios de prueba que franquea la ley: instrumental, testimonial, confesional, informe de peritos e inspección personal del tribunal».",
    });
  }

  return resultado;
}

const ICONO: Record<Severidad, string> = { critico: "❌", alto: "⚠️", medio: "ℹ️" };

/** Nota visible que se anexa al final del borrador. Nunca bloquea. */
export function notaTactica(hallazgos: HallazgoTactico[]): string {
  if (!hallazgos.length) return "";
  const lineas: string[] = [];
  lineas.push("\n\n## ⚠️ Control táctico del escrito (revisión obligatoria antes de presentar)\n");
  lineas.push("Control determinista (sin IA) sobre el texto ya generado: se detectaron fórmulas de riesgo procesal. Corrige o elimina cada frase antes de usar el escrito.\n");
  for (const h of hallazgos) {
    lineas.push(`- ${ICONO[h.severidad]} **${h.id}** — “${h.frase}”`);
    lineas.push(`  - Por qué: ${h.regla}`);
    lineas.push(`  - Corrección: ${h.reemplazo}`);
  }
  return lineas.join("\n");
}
