// QA Fase 7: motor determinista de plazos (plazosChile.ts). Sin red. Los
// valores esperados se derivan a mano de las reglas propias del motor:
// art 251 (corre al dia siguiente), inhábiles sáb/dom + feriados + vacaciones
// judiciales (feb) para civil; emplazamiento +2 días por cada 100 km (>50).
process.env.CORPUS_COMPLETO = "";
let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS` + (data !== undefined ? ` ${JSON.stringify(data)}` : "")); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}
const P = await import("../plazosChile.js");

// 1. civil_contestacion sin emplazamiento: notif vie 23-05-2025 (viernes).
//    art 251: corre al día siguiente (sáb 24 inhábil)... 15 hábiles: 26(m),27(x),28(j),29(v),30(s? no 30=viernes)... calc manual:
//    hábiles siguientes desde lun 26: 25 días hábiles no; contemos: mai/jun:
//    26,27,28,29,30 (5) | jun 2,3,4,5,6 (10) | 9,10,11,12,13 (15). => 2025-06-13
const r1 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2025-05-23", kmDemandado: 0 });
chk("1 civil 15 habiles desde vie 23-05: 13-06-2025", r1.ok && r1.fechaLimite === "2025-06-13", r1);

// 2. mismo plazo cruzando feriados de septiembre: notif vie 06-09-2024 (18/19
//    feriados, mier-jue 2024): hábiles desde lun 09: 9,10,11,12,13 (5); 16,17 (7);
//    20 (8); 23,24,25,26,27 (13); 30 (14) => 15.º hábil el 30-09 (sábado la
//    fracción? no: 30 es lunes) => limite 2024-10-01 no: cunta 9(1)...30(14), 01Oct(15) => 2024-10-01
const r2 = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2024-09-06", kmDemandado: 0 });
chk("2 laboral 15 habiles cruzando 18/19-09: 01-10-2024", r2.ok && r2.fechaLimite === "2024-10-01", r2);

// 3. vacaciones judiciales civiles (febrero suspende): notif lun 27-01-2025.
//    Empeza mar 28-01; 28,29,30,31 (4) + feb FOSSIL por vacaciones + mar 03-07 (9),
//    10-14 (14) y 17 (15) => 2025-03-17
const r3 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2025-01-27", kmDemandado: 0 });
chk("3 civil desde 27-01 con feb suspendido: 17-03-2025", r3.ok && r3.fechaLimite === "2025-03-17", r3);

// 4. emplazamiento km 400 => +8 dias (2*ceil((400-50)/100)=8): notif lun 03-03-2025
//    laboral sin vacaciones: desde mar 04, 15+8=23 habiles => 2025-04-03
const r4 = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2025-03-03", kmDemandado: 400 });
chk("4 laboral 15+8 emplazamiento km400: 03-04-2025", r4.ok && r4.fechaLimite === "2025-04-03" && r4.diasOtorgados === 23, r4);

// 5-7. tabla de emplazamiento
chk("5 diasEmplazamiento km50 = 0", P.diasEmplazamiento(50) === 0);
chk("6 diasEmplazamiento km51 = 2 (fraccion >50)", P.diasEmplazamiento(51) === 2);
chk("7 diasEmplazamiento km300 = 6", P.diasEmplazamiento(300) === 6);

// 8-10. plazos apelacion: laboral 5 habiles: notif mié 06-08-2025 -> jue 07 (1), vie 08 (2), lun 11 (3), mar 12 (4), mié 13 (5) => 2025-08-13
const r8 = P.calcularPlazo({ plazoId: "laboral_apelacion", fechaNotificacion: "2025-08-06" });
chk("8 laboral apelacion 5 habiles: 13-08-2025", r8.ok && r8.fechaLimite === "2025-08-13", r8);

// 9. familia movimiento en feb (NO suspende): notif vie 31-01-2025 -> familia/laboral no suspenden:
//    1 feb sab inhábil... primero hab de feb: lun 03 (1), 04 (2), 05 (3), 06 (4), 07 (5) => 2025-02-07
const r9 = P.calcularPlazo({ plazoId: "familia_apelacion", fechaNotificacion: "2025-01-31" });
chk("9 familia 5 habiles en feb (no suspende): 07-02-2025", r9.ok && r9.fechaLimite === "2025-02-07", r9);

// 10. civil notificado DENTRO de feb (suspende el mes saron): notif mar 03-02-2026:
//     contable solo en marzo: lun 02 (1), 3 (2), 4 (3) => 2026-03-04
const r10 = P.calcularPlazo({ plazoId: "civil_oposicion_medida", fechaNotificacion: "2026-02-03" });
chk("10 civil notificado en feb suspende hasta marzo: 04-03-2026", r10.ok && r10.fechaLimite === "2026-03-04", r10);

// 11. plazoId inexistente no arroja y marca VERIFICAR
const r11 = P.calcularPlazo({ plazoId: "inexistente", fechaNotificacion: "2025-05-23" });
chk("11 plazo desconocido -> ok=false con VERIFICAR", !r11.ok && (r11.aviso || "").includes("VERIFICAR"), r11.aviso);

// 12. fecha invalida -> ok=false
const r12 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "no-fecha" });
chk("12 fecha invalida -> ok=false", !r12.ok, r12.aviso);

// 13. Pascua 2024 = 31-03 => Viernes Santo 29-03-2024 debe ser feriado
chk("13 vienres santo 2024 en feriadosAnio", P.feriadosAnio(2024).has("2024-03-29"));

// 14. reg del extractor: detectarFechaNotificacion
const t14 = "La demanda fue notificada el 12 de marzo de 2024 por cédula en calle Santiago.";
chk("14 detecta notificacion textual 12-03-2024", P.detectarFechaNotificacion(t14) === "2024-03-12");
const t15 = "notificada por carta el 3/4/2024";
chk("15 detecta notificacion numerica 03-04-2024", P.detectarFechaNotificacion(t15) === "2024-04-03");
const t16 = "El demandante ingreso la demanda ayer";
chk("16 falta de fecha -> null", P.detectarFechaNotificacion(t16) === null);

// 17. bloque de prompt vacio cuando no hay calculos ok
chk("17 bloquePromptPlazos vacio sin exitos", P.bloquePromptPlazos([r11, r12]) === "");

// 18-20. cross-check: ¿el borrador consigna la fecha límite del motor?
const f6 = fmt(r1.fechaLimite as string);
chk("18 cross-check detecta fecha ISO en borrador", P.chequearPlazosEnBorrador([r1], "El demandado debe contestar para el " + f6).every((c) => c.consignado));
chk("19 cross-check detecta formato '13 de junio de 2025'", P.chequearPlazosEnBorrador([r1], "notifique el vencimiento el 13 de junio de 2025").every((c) => c.consignado));
chk("20 cross-check marca FALTANTE si el borrador omite la fecha", P.chequearPlazosEnBorrador([r1], "Pedimos se rechace la demanda.").some((c) => !c.consignado));

function fmt(iso: string): string { return P.fmtFechaChilena(iso).variantes[0]; }

console.log(fail === 0 ? `\nQA plazos Fase 7: ${ok}/${ok + fail} PASS` : `\nQA plazos Fase 7: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
