// QA Lint Táctico del borrador (sin LLM, sin red, sin DB).
// Por qué existe: el modelo redactó dentro de una DEMANDA fórmulas propias de la
// contestación — "ha procedido o procederá a la regularización y pago … con el
// objeto de convalidar el despido" y "se allana al pago de las sumas que pudieren
// corresponder … si existiere algún saldo". Este script obliga a que el lint
// detecte exactamente esas frases y sus variantes sin bloquear nada.
import { lintTactico, notaTactica } from "../lintTactico";
import type { ContextoTactico } from "../lintTactico";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(typeof data === "string" ? data.slice(0, 400) : (data ?? "")).slice(0, 400)}`); }
}

const ctxContestacion: ContextoTactico = { tipo: "contestacion", postura: "demandado" };
const ctxDemanda: ContextoTactico = { tipo: "demanda", postura: "demandante" };
const ctxOtrosi: ContextoTactico = { tipo: "otrosi", postura: null };
const ctxVencido: ContextoTactico = { tipo: "contestacion", postura: "demandado", plazoVencido: true };
const ctxVencidoNo: ContextoTactico = { tipo: "contestacion", postura: "demandado", plazoVencido: false };

const F_FRASE1 = "Mi representada ha procedido o procederá a la regularización y pago de las cotizaciones, con el objeto de convalidar el despido.";
const F_FRASE2 = "Mi representada se allana al pago de las sumas que por concepto de feriado proporcional y/o legal adeudado pudieren corresponder al actor, si es que existiere algún saldo pendiente.";

const r1 = lintTactico(F_FRASE1, ctxContestacion);
chk("Ley Bustos: frase exacta reportada detectada como bustos_futuro", r1.some((h) => h.id === "bustos_futuro"), r1.map((h) => h.id));
chk("Ley Bustos: la anotación incluye la frase exacta y la corrección con fecha/prueba", notaTactica(r1).includes("regularizaci") && notaTactica(r1).includes("fecha"));

const r2 = lintTactico("La demandada procederá a regularizar las cotizaciones impagas de los meses de julio y agosto.", ctxContestacion);
chk("Variante: 'procederá a regularizar las cotizaciones' detectada", r2.some((h) => h.id === "bustos_futuro"), r2.map((h) => h.id));

const r3 = lintTactico("En su mérito, se convalidará el despido una vez pagadas las cotizaciones.", ctxContestacion);
chk("Variante: 'se convalidará' / 'una vez pagadas' detectada", r3.some((h) => h.id === "bustos_futuro"), r3.map((h) => h.id));

const r4 = lintTactico(F_FRASE2, ctxContestacion);
chk("Allanamiento: frase exacta reportada detectada (allanamiento)", r4.some((h) => h.id === "allanamiento"), r4.map((h) => h.id));

const r5 = lintTactico("La demandada se allana a cuanto el actor pueda solicitar, por si acaso existiere algún saldo.", ctxContestacion);
chk("Variante: 'se allana a cuanto' + 'por si acaso' detectada", r5.some((h) => h.id === "allanamiento" || h.id === "feriado_hedge"), r5.map((h) => h.id));

// Fórmulas correctas: NO deben disparar hallazgos
const A = "La nulidad del despido se encuentra íntegramente convalidada con fecha 2 de mayo de 2026, mediante pago íntegro de las cotizaciones adeudadas y su notificación fehaciente al trabajador y a la Inspección del Trabajo, por lo que la sanción carece de objeto actual.";
const rA = lintTactico(A, ctxContestacion);
chk("Fórmula correcta A (convalidación con fecha + prueba) sin hallazgos", !rA.some((h) => h.id.startsWith("bustos") || h.id === "allanamiento"), rA.map((h) => h.id + ":" + h.frase));

const B = "Se niega que las cotizaciones previsionales se encontraran impagas al momento del despido; la demandante debe acreditarlo con los certificados de cotización y registros de la respectiva AFP o institución, en mérito de lo dispuesto en el artículo 162 inciso quinto del Código del Trabajo.";
const rB = lintTactico(B, ctxContestacion);
chk("Fórmula correcta B (negar presupuesto + exigir prueba) sin hallazgos", !rB.some((h) => h.id.startsWith("bustos") || h.id === "allanamiento"), rB.map((h) => h.id + ":" + h.frase));

const F = "Se niega que el actor mantenga saldo alguno por concepto de feriado proporcional y/o legal, debiendo este acreditar fehacientemente mediante liquidaciones y registros que prestó servicios efectivos sin hacer uso de su feriado legal durante los períodos reclamados.";
const rF = lintTactico(F, ctxContestacion);
chk("Fórmula correcta de feriado (negar + cargar prueba) sin hallazgos", !rF.some((h) => h.id === "allanamiento" || h.id === "feriado_hedge"), rF.map((h) => h.id + ":" + h.frase));

const rNoAll = lintTactico("La demandada no se allana a las pretensiones de cobro de feriado proporcional.", ctxContestacion);
chk("Excepción: 'no se allana' NO se marca como allanamiento", !rNoAll.some((h) => h.id === "allanamiento"), rNoAll.map((h) => h.id));

// Postura
const demInv = lintTactico("EXCEPCIONES PREVIAS: pago. NEGATIVA DE HECHOS: se niega el segundo hecho. DEFENSAS DE FONDO: art. 1552 CC.", ctxDemanda);
chk("Postura: fórmulas de contestación en una DEMANDA se detectan", demInv.some((h) => h.id === "postura_demanda"), demInv.map((h) => h.id));

const conInv = lintTactico("VENGO EN DEMANDAR a Inmobiliaria Andes SpA y solicito se condene a la demandada a pagar las rentas adeudadas.", ctxContestacion);
chk("Postura: fórmulas de demanda en una CONTESTACIÓN se detectan", conInv.some((h) => h.id === "postura_contestacion"), conInv.map((h) => h.id));

const otrosi = lintTactico("EXCEPCIONES PREVIAS: pago.", ctxOtrosi);
chk("Otros sin postura declarada no se marca por inversión de postura", !otrosi.some((h) => h.id === "postura_contestacion" || h.id === "postura_demanda"));

// Monitorio de arrendamiento (Ley 18.101 art. 18-F)
const monSin = lintTactico(
  "OPOSICIÓN FUNDADA A LA DEMANDA MONITORIA DE ARRENDAMIENTO. PRIMER OTROSÍ: acompaña los documentos indicados.",
  ctxContestacion,
);
chk("Monitorio sin medios de prueba → monitorio_sin_medios_prueba", monSin.some((h) => h.id === "monitorio_sin_medios_prueba"), monSin.map((h) => h.id));
const monCon = lintTactico(
  "OPOSICIÓN FUNDADA A LA DEMANDA MONITORIA DE ARRENDAMIENTO (Ley 18.101). OTROSÍ: se valdrá de prueba instrumental, testimonial y pericial. PRIMER OTROSÍ: acompaña documentos.",
  ctxContestacion,
);
chk("Monitorio con medios de prueba anunciados → sin hallazgo", !monCon.some((h) => h.id === "monitorio_sin_medios_prueba"));

// CPC 254 en contestación
const cpc254 = lintTactico("En derecho fundo mi contestación en el art. 254 del Código de Procedimiento Civil.", ctxContestacion);
chk("Cita impertinente del Art. 254 CPC en contestación detectada", cpc254.some((h) => h.id === "cpc_254_en_contestacion"), cpc254.map((h) => h.id));

// Petitorio del requerimiento monitorio
const den = lintTactico("POR TANTO, solicito denegar la solicitud de requerimiento de pago efectuada por la actora.", ctxContestacion);
chk("Petitorio monitorio impertinente detectado", den.some((h) => h.id === "monitorio_petitorio_requerimiento"), den.map((h) => h.id));

// Plazo vencido
const dentro = lintTactico("Que encontrándome dentro de plazo legal vengo en contestar la demanda.", ctxVencido);
chk("Plazo vencido + 'dentro de plazo legal' → hallazgo crítico", dentro.some((h) => h.id === "plazo_vencido_afirmado"), dentro.map((h) => h.id));
const dentroNo = lintTactico("Que encontrándome dentro de plazo legal vengo en contestar la demanda.", ctxVencidoNo);
chk("Plazo no vencido → sin hallazgo de plazo vencido", !dentroNo.some((h) => h.id === "plazo_vencido_afirmado"));

// Calificativos
const cal = lintTactico("Los gastos comunes exigidos maliciosamente exigidos por la actora deben rechazarse íntegra e imprevista.", ctxContestacion);
chk("Calificativos forenses impropios detectados", cal.some((h) => h.id === "calificativos_forenses"), cal.map((h) => h.id));

// Nota
const nota = notaTactica([
  { id: "bustos_futuro", severidad: "critico", frase: "procederá a pagar", regla: "r", reemplazo: "cor" },
]);
chk("notaTactica incluye el id del hallazgo, la frase y la corrección", nota.includes("bustos_futuro") && nota.includes("procederá a pagar") && nota.includes("cor"));

console.log(fail === 0 ? `\nQA borrador táctico: ${ok}/${ok + fail} PASS` : `\nQA borrador táctico: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
