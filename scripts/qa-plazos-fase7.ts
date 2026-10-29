// QA Fase 7: motor determinista de plazos (plazosChile.ts). Sin red. Los
// valores esperados se derivan a mano de las reglas propias del motor:
// art 251 (corre al dia siguiente); CIVIL: lunes-sabado, suspenden domingos y
// feriados (CPC art. 258 "dieciocho dias" segun Ley 21.394 + art. 66 + Ley
// 2.977: domingos feriados, sabados no); LABORAL/FAMILIA: lun-vie; feriados
// fijos + traslados (19.668 lunes, 20.299 viernes, 21.357 solsticio);
// emplazamiento +2 dias por cada 100 km (>50). Fase B (2026-10-29).
process.env.CORPUS_COMPLETO = "";
let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS` + (data !== undefined ? ` ${JSON.stringify(data)}` : "")); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}
const P = await import("../plazosChile.js");

// 1. civil_contestacion sin emplazamiento: notif vie 23-05-2025 (viernes).
//    Regla nueva (18 dias, sabados corren): dia 1 = sab 24 (1); dom 25 skip;
//    26-30 (6); sab 31 (7); jun 2-6 (12); sab 7 (13); 9-13 (18) => 2025-06-13
//    (coincidencia: +3 dias ≈ 3 sabados que ahora corren).
const r1 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2025-05-23", kmDemandado: 0 });
chk("1 civil 18 dias (lun-sab) desde vie 23-05: 13-06-2025", r1.ok && r1.fechaLimite === "2025-06-13", r1);

// 2. mismo plazo cruzando feriados de septiembre: notif vie 06-09-2024 (18/19
//    feriados, mier-jue 2024): hábiles desde lun 09: 9,10,11,12,13 (5); 16,17 (7);
//    20 (8); 23,24,25,26,27 (13); 30 (14) => 15.º hábil el 30-09 (sábado la
//    fracción? no: 30 es lunes) => limite 2024-10-01 no: cunta 9(1)...30(14), 01Oct(15) => 2024-10-01
const r2 = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2024-09-06", kmDemandado: 0 });
chk("2 laboral 15 habiles cruzando 18/19-09: 01-10-2024", r2.ok && r2.fechaLimite === "2024-10-01", r2);

// 3. Ley 20.774 (D.O. 04-09-2014): febrero ya NO suspende los plazos civiles
//    (elimina inc. 2º del art. 66 CPC; art. 7º deroga referencias al feriado
//    judicial de febrero). Regla nueva (18 dias, sabados corren): notif lun
//    27-01-2025: 28-31 (4, sab 30 corre); feb 1-8 (11, dom 2 skip), 10-15
//    (17, dom 9 skip), 17 (18, dom 16 skip) => 2025-02-17 (coincidencia con
//    la regla vieja de 15 habiles lun-vie).
const r3 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2025-01-27", kmDemandado: 0 });
chk("3 civil desde 27-01 sin feb suspendido (Ley 20.774): 17-02-2025", r3.ok && r3.fechaLimite === "2025-02-17", r3);

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

// 10. civil notificado DENTRO de febrero (Ley 20.774: corre normal): notif mar
//     03-02-2026: desde mie 04: 4 (1), 5 (2), 6 (3) => 2026-02-06
const r10 = P.calcularPlazo({ plazoId: "civil_oposicion_medida", fechaNotificacion: "2026-02-03" });
chk("10 civil notificado en feb corre (Ley 20.774): 06-02-2026", r10.ok && r10.fechaLimite === "2026-02-06", r10);

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

// 21-24. calibración gate: ambigüedad, vencido, única fecha no ambigua
const amb = P.detectarFechasNotificacion("Fue notificada en calle Santiago el 5 de mayo de 2024 y con cédula el 19 de mayo de 2024.");
chk("21 dos fechas distintas -> ambigua=true", amb.ambigua && amb.fechas.length === 2, amb);
const unica = P.detectarFechasNotificacion("La demanda fue notificada con fecha 05-05-2024. La misma fecha se resexo: notificada el 5 de mayo de 2024.");
chk("22 misma fecha duplicada NO es ambigua", !unica.ambigua && unica.fechas.length === 1 && unica.primera === "2024-05-05", unica);
const rv = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2023-10-02" });
chk("23 plazo pasado -> vencido=true (12-oct-2023 traslado a lun 09)", rv.ok && rv.vencido === true && rv.fechaLimite === "2023-10-24" && (rv.fechaLimite || "") < P.hoyIso(), rv);
const rvf = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2027-03-03" });
chk("24 plazo futuro -> vencido=false", rvf.ok && rvf.vencido === false, rvf);
const not21 = P.anotacionesPlazos([rv], "El demandado debía contestar para el 24 de octubre de 2023.", { fechas: ["2023-10-02"], primera: "2023-10-02", ambigua: false });
chk("25 nota plazo_vencido en anotaciones", not21.some((a) => a.includes("plazo_vencido") && a.includes("2023-10-24")), not21);
const not22 = P.anotacionesPlazos([rv], "", { fechas: ["2024-05-05", "2024-05-19"], primera: "2024-05-05", ambigua: true });
chk("26 nota fecha_notificacion_ambigua", not22.some((a) => a.includes("fecha_notificacion_ambigua")), not22);

// ── Fase B (2026-10-29): regla civil 18 dias lun-sab + feriados corregidos ──
// 27. CASO DEL DUEÑO (demandas civil incendio): notif jue 29-10-2026.
//     Dia 1 = vie 30; sab 31-oct FERIADO (evangelico; 2026 cae sabado y no se
//     traslada) y dom 1-nov FERIADO (Ley 2.977); 18 dias: 30(1), nov 2-7 (7,
//     dom 1 skip, sab 7 corre), 9-14 (13, dom 8 skip), 16-20 (18, dom 15 skip)
//     => viernes 20-11-2026.
const r27 = P.calcularPlazo({ plazoId: "civil_contestacion", fechaNotificacion: "2026-10-29", kmDemandado: 0 });
chk("27 caso dueno civil 18 dias notif 29-10-2026: 20-11-2026", r27.ok && r27.fechaLimite === "2026-11-20", r27);
// 28. traslados Ley 19.668: 12-oct-2027 cae MARTES -> lunes 11-oct-2027; y
//     29-jun-2027 cae MARTES -> lunes 28-jun-2027.
chk("28 traslado 12-oct-2027 (mar) -> lun 11-oct", P.feriadosAnio(2027).has("2027-10-11") && !P.feriadosAnio(2027).has("2027-10-12"));
chk("29 traslado 29-jun-2027 (mar) -> lun 28-jun", P.feriadosAnio(2027).has("2027-06-28") && !P.feriadosAnio(2027).has("2027-06-29"));
// 30. traslado Ley 20.299 art. 2 por dia de semana real (verificado con
//     Date.UTC): 2027 dom -> fecha propia 31-oct; 2028 mar -> vie 27-oct;
//     2029 mie -> vie 02-nov; y 1-nov sigue feriado fijo en los tres anios.
chk("30 traslado 31-oct: 2027 dom fecha propia; 2028 mar -> vie 27-oct; 2029 mie -> vie 02-nov",
  P.feriadosAnio(2027).has("2027-10-31") && P.feriadosAnio(2027).has("2027-11-01") &&
  P.feriadosAnio(2028).has("2028-10-27") && !P.feriadosAnio(2028).has("2028-10-31") &&
  P.feriadosAnio(2029).has("2029-11-02") && !P.feriadosAnio(2029).has("2029-10-31"));
// 31. Ley 21.357: solsticio de invierno. 2025 = vie 20-jun (gob.cl); 2026 = dom 21-jun.
chk("31 solsticio 2025 = 20-jun; 2026 = 21-jun", P.feriadosAnio(2025).has("2025-06-20") && P.feriadosAnio(2026).has("2026-06-21"));
// 32. entradas espurias eliminadas: 24-dic y 31-dic NO son feriados.
chk("32 sin 24-dic ni 31-dic", !P.feriadosAnio(2026).has("2026-12-24") && !P.feriadosAnio(2026).has("2026-12-31"));
// 33. civil corre el 24-dic-2026 (antes lo saltaba): notif mie 23-12-2026,
//     5 dias: jue 24 (1; navidad 25 skip; sab 26 corre (2); dom 27 skip;
//     lun 28 (3); mar 29 (4); mie 30 (5)) => 2026-12-30.
const r33 = P.calcularPlazo({ plazoId: "civil_apelacion_auto", fechaNotificacion: "2026-12-23" });
chk("33 civil cruza 24-dic (ya corre): 30-12-2026", r33.ok && r33.fechaLimite === "2026-12-30", r33);
// 34. laboral corre el 31-dic-2026 (antes lo saltaba): notif mie 30-12-2026,
//     5 habiles: jue 31 (1); vie 1-ene FERIADO skip; lun 4 (2); mar 5 (3);
//     mie 6 (4); jue 7 (5) => 2027-01-07.
const r34 = P.calcularPlazo({ plazoId: "laboral_apelacion", fechaNotificacion: "2026-12-30" });
chk("34 laboral cruza 31-dic (ya corre): 07-01-2027", r34.ok && r34.fechaLimite === "2027-01-07", r34);
// 35. laboral NOT corre sabados y respeta el traslado de 29-jun-2026 (lun):
//     notif mie 24-06-2026, 15 habiles: 25-26 (2); 29 FERIADO skip; 30 (3);
//     jul 1-3 (6); 6-10 (11); 13-15 (14); 16 FERIADO (Virgen del Carmen) skip;
//     17 (15) => 2026-07-17.
const r35 = P.calcularPlazo({ plazoId: "laboral_contestacion", fechaNotificacion: "2026-06-24", kmDemandado: 0 });
chk("35 laboral cruza 29-jun y 16-jul-2026: 17-07-2026", r35.ok && r35.fechaLimite === "2026-07-17", r35);

console.log(fail === 0 ? `\nQA plazos Fase 7: ${ok}/${ok + fail} PASS` : `\nQA plazos Fase 7: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
