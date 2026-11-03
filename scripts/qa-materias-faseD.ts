// QA Fase D: registro único de materias (materias.ts) + recuperación gobernada
// por área (jurisprudenciaChile.ts). Sin red. Reglas del dueño que se pican
// aquí como regresión:
//  - el área declarada MANDA (señales solo sugieren; conflicto = anotación);
//  - sin señal = null (indeterminada) — NUNCA "laboral" por defecto;
//  - transito existe como materia (sin corpus propio: capa transversal
//    etiquetada) — decisión "7 corpus + tránsito";
//  - todo fallback es visible (fuenteFallback/fuenteTransversal), jamás
//    silencioso; la confianza es margen/conteos crudos, no % inventado.
let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}

const M = await import("../materias.js");
const J = await import("../jurisprudenciaChile.js");

// ── clasificarMateria: señal fuerte por materia ─────────────────────────────
// 1. laboral claro ("S.J.L." cuenta x2, despido x3... margen amplio)
const c1 = M.clasificarMateria("Despedido por necesidades de la empresa. Juzgado de letras del trabajo ROL 1234-2026. Finiquito y cotizaciones impagas.");
chk("1 clasifica laboral con señales fuertes", c1.slug === "laboral" && c1.margen > 0, c1);
// 2. civil claro
const c2 = M.clasificarMateria("Se notificó la demanda de indemnización de perjuicios por incumplimiento de contrato de arrendamiento. Juzgado de letras en lo civil de Santiago.");
chk("2 clasifica civil con señales fuertes", c2.slug === "civil" && c2.margen > 0, c2);
// 3. transito claro (decisión: la materia existe, aunque el corpus propio venga en Fase H)
const c3 = M.clasificarMateria("Multa por infracción de tránsito TAG y alcoholemia ante juzgado de policía local. Ley 18.290. Amenaza de suspensión de licencia de conducir.");
chk("3 clasifica transito con señales fuertes", c3.slug === "transito" && c3.margen > 0, c3);
// 4. SIN señal => null (indeterminada). Regresión del default "laboral".
const c4 = M.clasificarMateria("El cliente pide redactar un escrito sobre su situación.");
chk("4 sin señales => null (nunca laboral)", c4.slug === null, c4);
// 5. familia
const c5 = M.clasificarMateria("Demanda de alimentos y cuidado personal ante el juzgado de familia. Relación directa y regular con los nietos.");
chk("5 clasifica familia", c5.slug === "familia", c5);

// ── resolverMateria (Fase D.2): la plataforma decide con señales concluyentes;
//    el área declarada es respaldo y desempate; discrepancia = anotación ────
// 6. declarada civil + texto laboral fuerte => la plataforma decide laboral
const r6 = M.resolverMateria("civil", "Despido injustificado, finiquito y cotizaciones impagas ante juzgado del trabajo.");
chk("6 plataforma decide laboral sobre declarada civil", r6.slug === "laboral" && r6.origen === "senales" && !!r6.conflicto && r6.conflicto.includes("materia_decidida_por_plataforma"), r6);
// 7. declarada civil + texto civil => la plataforma confirma civil, sin conflicto
const r7 = M.resolverMateria("civil", "Se notificó la demanda de indemnización de perjuicios por incumplimiento contractual.");
chk("7 declarada civil con texto civil: confirma sin conflicto", r7.slug === "civil" && r7.conflicto === null && r7.origen === "senales", r7);
// 8. sin área declarada + señales transito => origen señales
const r8 = M.resolverMateria(null, "Multa de tránsito TAG ante juzgado de policía local, ley 18.290.");
chk("8 sin área + señales transito => transito (origen señales)", r8.slug === "transito" && r8.origen === "senales", r8);
// 9. sin área y sin señales => indeterminada
const r9 = M.resolverMateria(null, "Texto sin señales de materia alguna.");
chk("9 sin área y sin señales => indeterminada", r9.slug === null && r9.origen === "indeterminada", r9);
// 10. normalización: policia_local (wizard) => transito; otro => null
chk("10 normalizarAreaDeclarada policia_local=>transito, otro=>null",
  M.normalizarAreaDeclarada("policia_local") === "transito" && M.normalizarAreaDeclarada("otro") === null && M.normalizarAreaDeclarada("TRANSITO") === "transito" && M.normalizarAreaDeclarada("") === null,
  { p: M.normalizarAreaDeclarada("policia_local"), o: M.normalizarAreaDeclarada("otro") });

// ── prompt honesto: sin porcentajes de confianza inventados ────────────────
// 11. lineaMateriaPrompt contiene materia gobernante y conteos crudos, sin "%"
const l11 = M.lineaMateriaPrompt(r6);
chk("11 prompt: materia gobernante + señales crudas, sin % inventado",
  l11.includes("MATERIA QUE GOBIERNA ESTE CASO: Laboral") && l11.includes("[ANOTACIÓN]") && l11.includes("decidida por la plataforma") && !/%/.test(l11), l11);
// 12. indeterminada se declara como tal (no silencio, no laboral)
const l12 = M.lineaMateriaPrompt(r9);
chk("12 prompt indeterminada honesto", l12.includes("indeterminada"), l12);

// ── tagAreaCaso: marcadores explícitos del corpus de casos ─────────────────
// 13. "(LABORAL) QUEJA" => laboral; "INA-STC" => constitucional; resto null
const tag = J.tagAreaCaso as (c: { materia?: string | null; tribunal?: string | null }) => string | null;
chk("13 tagAreaCaso marcadores explicitos",
  tag({ materia: "(LABORAL) QUEJA", tribunal: "Corte Suprema" }) === "laboral" &&
  tag({ materia: "INA-STC", tribunal: "Corte Suprema" }) === "constitucional" &&
  tag({ materia: "OTROS", tribunal: "Corte de Apelaciones de Santiago" }) === null,
  null);

// ── recuperación gobernada por área (CORPUS_COMPLETO encendido) ────────────
// 14. civil: con corpus propio, ninguna ficha de la base laboral sin etiqueta.
const idxCiv = await J.buscarJurisprudencia(["arriendo, pago de renta, demanda de indemnización de perjuicios por incumplimiento de contrato"], 8, "civil");
const mezcla = idxCiv.filter(i => !i.fuenteFallback && !i.fuenteTransversal && /\blaboral\b/i.test(`${i.materia} ${i.autor} ${i.obra}`));
chk("14 civil: sin fichas de base laboral sin etiqueta (y trae resultados)", idxCiv.length > 0 && mezcla.length === 0, { total: idxCiv.length, mezcla: mezcla.length });
// 15. transito sin corpus propio: corre sobre capa transversal ETIQUETADA.
//     Puede traer 0 fichas (transversal sin match) — lo que está prohibido es
//     servir fichas laborales SIN etiqueta.
const idxTra = await J.buscarJurisprudencia(["multa de tránsito TAG juzgado de policía local licencia de conducir"], 8, "transito");
const sinEtiqueta = idxTra.filter(i => i.fuenteFallback || i.fuenteTransversal ? false : /\blaboral\b/i.test(`${i.materia} ${i.autor} ${i.obra}`));
chk("15 transito: resultados solo de capa transversal etiquetada (o vacíos)", sinEtiqueta.length === 0, { total: idxTra.length, sinEtiqueta: sinEtiqueta.length });
// 16. casos análogos civil: ningún caso tagged laboral sin fuenteFallback
const casosCiv = await J.buscarCasosJuris(["demanda de indemnización de perjuicios por incumplimiento de contrato de arriendo"], 8, "civil");
const malos = casosCiv.filter(c => J.tagAreaCaso(c) === "laboral" && !c.fuenteFallback);
chk("16 casos civil: sin '(LABORAL)' sin etiqueta de fallback", casosCiv.length > 0 && malos.length === 0, { total: casosCiv.length, malos: malos.length });
// 17. casos laborales con slug laboral: los (LABORAL) quedan (sin degradar)
const casosLab = await J.buscarCasosJuris(["despido injustificado, finiquito, cotizaciones impagas, tutela laboral"], 8, "laboral");
chk("17 casos laboral: sigue recuperando casos laborales", casosLab.length > 0 && casosLab.filter(c => J.tagAreaCaso(c) === "laboral").length > 0, { total: casosLab.length });

// ── integración ligera con handleLegalHelpDraft (mock LLM NO requerido:
//    solo se valida la resolución previa + metadatos deterministas) ──────────
// 18. resolverMateria sobre input realista civil (área declarada): la
//     plataforma confirma civil con sus señales (no la pisa ni la ignora).
const r18 = M.resolverMateria("civil", "Nos notificaron la demanda civil el jueves 29 de octubre de 2026 mediante cedula. Indemnizacion de perjuicios.");
chk("18 draft civil: plataforma confirma civil + conflicto null", r18.slug === "civil" && r18.conflicto === null && r18.origen === "senales", r18);

// 19. getArticulosClave: null => []; transito => []; laboral sigue igual
const T = await import("../legalhelp-templates.js");
chk("19 getArticulosClave null-safe (nunca cae a laboral)",
  T.getArticulosClave(null).length === 0 && T.getArticulosClave("transito").length === 0 &&
  T.getArticulosClave("civil").length > 0 && T.getArticulosClave("laboral").length > 0,
  { n: T.getArticulosClave(null), t: T.getArticulosClave("transito") });

// ── Fase D.2: límites de la decisión automática (honestidad) ────────────────
// 20. señal débil (una "multa" = 2 puntos) NO impone materia sobre la declarada.
const r20 = M.resolverMateria("civil", "Me pusieron una multa por estacionar mal.");
chk("20 señales débiles: se mantiene la declarada + conflicto", r20.slug === "civil" && r20.origen === "declarada" && !!r20.conflicto && r20.conflicto.includes("conflicto_materia"), r20);
// 21. sin área + señal débil => detecta pero con advertencia [VERIFICAR].
const r21 = M.resolverMateria(null, "Me pusieron una multa por estacionar mal.");
chk("21 sin área + señales débiles => detecta con advertencia", r21.slug === "transito" && r21.origen === "senales" && !!r21.advertencia && r21.advertencia.includes("materia_sugerida"), r21);
// 22. empate de señales sin área => indeterminada (no se inventa materia).
//     "Despido" (3) vs "cédula"(2)+"demanda"(1): sin regla de contexto que desempate.
const r22 = M.resolverMateria(null, "Despido. Cédula. Demanda.");
chk("22 empate sin área => indeterminada con advertencia", r22.slug === null && r22.origen === "indeterminada" && !!r22.advertencia && r22.advertencia.includes("materia_ambigua"), r22);
// 23. empate con área declarada => la declarada desempata (anotado).
const r23 = M.resolverMateria("civil", "Despido. Cédula. Demanda.");
chk("23 empate con declarada => desempata la declarada", r23.slug === "civil" && r23.origen === "declarada" && !!r23.conflicto, r23);

// ── Fase D.3: negación por oración (el "no" no suma materia) ────────────────
// 24. "No hubo despido, sino un accidente": el despido NO suma laboral.
const n24 = M.clasificarMateria("No hubo despido, sino un accidente en la obra.");
chk("24 negación: 'no hubo despido' no suma laboral",
  n24.slug === null && n24.negaciones.some((x: string) => x.toLowerCase().includes("despido")) &&
  n24.senales.some((x: any) => x.slug === "laboral" && x.estado === "NEGADA"), n24);
// 25. "no fue despedido; renunció": el ';' corta el alcance y no hay materia.
const n25 = M.clasificarMateria("El trabajador no fue despedido; renunció.");
chk("25 negación: 'no fue despedido' anulado, resto insuficiente",
  n25.slug === null && n25.negaciones.some((x: string) => x.toLowerCase().includes("despido")) &&
  n25.senales.some((x: any) => x.nombre === "otros laboral" && x.estado === "POSITIVA"), n25);
// 26. "No corresponde pensión de alimentos": familia negada, no decide.
const n26 = M.clasificarMateria("No corresponde pensión de alimentos.");
chk("26 negación: pensión de alimentos negada no decide familia",
  n26.slug === null && n26.negaciones.some((x: string) => x.includes("Familia")), n26);
// 27. resolverMateria sin área: indeterminada + advertencia de negación.
const n27 = M.resolverMateria(null, "No hubo despido, sino un accidente en la obra.");
chk("27 negación sin área: indeterminada con negacion_detectada",
  n27.slug === null && n27.origen === "indeterminada" && !!n27.advertencia && n27.advertencia.includes("negacion_detectada"), n27);
// 28. El alcance termina en puntuación fuerte: la segunda oración sí decide.
const n28 = M.clasificarMateria("No hubo acuerdo. La empresa me despidió injustificadamente.");
chk("28 negación acotada: segunda oración decide laboral",
  n28.slug === "laboral" && n28.scores[0].puntos >= 3, n28);
// 29. Negación + señal positiva de la misma materia => conflicto visible.
const n29 = M.clasificarMateria("No hubo despido; sin embargo, la empresa me despidió injustificadamente.");
chk("29 negación + positivo: laboral con conflicto anotado",
  n29.slug === "laboral" && n29.negaciones.length > 0 && n29.conflictos.some((x: string) => x.includes("Laboral")), n29);
// 30. Hedge ("creo que no"): DEBILITADA (0.25), no alcanza el umbral.
const n30 = M.clasificarMateria("Creo que no hubo despido injustificado.");
chk("30 negación conjetural: DEBILITADA y no decide",
  n30.slug === null && n30.senales.some((x: any) => x.estado === "DEBILITADA"), n30);
// 31. "no solo ... sino también" NO es negación.
const n31 = M.clasificarMateria("No solo hubo despido injustificado, sino también acoso laboral.");
chk("31 'no solo' no niega: laboral decidido sin negaciones",
  n31.slug === "laboral" && n31.negaciones.length === 0, n31);
// 32. Negación en una oración y hecho positivo en otra: decide y anota.
const n32 = M.resolverMateria(null, "No corresponde pensión de alimentos; aun así el juzgado de familia fijó alimentos provisorios.");
chk("32 negación no bloquea: familia decidida con conflicto",
  n32.slug === "familia" && n32.negaciones.length > 0 && n32.clasificacion.conflictos.length > 0, n32);
// 33. lineaMateriaPrompt publica la negación como evidencia.
const n33 = M.lineaMateriaPrompt(n27);
chk("33 prompt: imprime [NEGACIÓN] con la señal anulada",
  n33.includes("[NEGACIÓN]") && n33.toLowerCase().includes("despido") && n33.includes("No uses esos hechos"), n33);

// ── Fase D.3-v2: negación de acción + anclas + casos mixtos ────────────────
// 34. El caso del dueño (mezcla laboral+arriendo en UNA oración): "no me
//     pagaron" y "no me quiere devolver" son incumplimientos AFIRMADOS — no
//     anulan señal; laboral gana y civil queda como secundaria.
const textoDueño = "Me echaron del trabajo pero no me pagaron el finiquito y además el dueño de la casa no me quiere devolver el mes de garantía.";
const r34 = M.resolverMateria(null, textoDueño);
chk("34 caso mixto: laboral principal + civil secundaria + incumplimientos afirmados",
  r34.slug === "laboral" && r34.origen === "senales" && r34.materiaSecundaria === "civil" &&
  r34.clasificacion.incumplimientos.length >= 2 &&
  !r34.negaciones.some((x: string) => x.toLowerCase().includes("finiquito")), r34);
// 35. Ancla estructural (escritura pública) inclina sin relato, con tope.
const c35 = M.clasificarMateria("Escritura pública de compraventa, otorgada ante notario.");
chk("35 anclas: escritura pública + notario => civil sugerida",
  c35.slug === "civil" && c35.senales.some((x: any) => x.nombre === "ancla:escritura publica" && x.estado === "POSITIVA"), c35);
// 36. Las anclas son marcadores del documento: la negación no las anula.
const c36 = M.clasificarMateria("El trámite no requiere escritura pública.");
chk("36 anclas no se anulan por negación (marcador, no hecho)",
  c36.slug === "civil" && c36.senales.some((x: any) => x.nombre === "ancla:escritura publica"), c36);
// 37. El prompt publica secundaria, corpus y hechos afirmados.
const l37 = M.lineaMateriaPrompt(r34);
chk("37 prompt: [SECUNDARIA] + [HECHO AFIRMADO] visibles",
  l37.includes("[SECUNDARIA]") && l37.includes("Civil") && l37.includes("[HECHO AFIRMADO]"), l37);

console.log(`\nQA Fase D: ${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
