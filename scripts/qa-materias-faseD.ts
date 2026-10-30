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

// ── resolverMateria: el área declarada manda ────────────────────────────────
// 6. declarada civil + texto laboral => civil + conflicto VISIBLE
const r6 = M.resolverMateria("civil", "Despido injustificado, finiquito y cotizaciones impagas ante juzgado del trabajo.");
chk("6 declarada civil manda sobre señales laboral", r6.slug === "civil" && r6.origen === "declarada" && !!r6.conflicto && r6.conflicto.includes("conflicto_materia"), r6.conflicto);
// 7. declarada civil + texto civil => sin conflicto
const r7 = M.resolverMateria("civil", "Se notificó la demanda de indemnización de perjuicios por incumplimiento contractual.");
chk("7 declarada civil con texto civil: sin conflicto", r7.slug === "civil" && r7.conflicto === null, r7);
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
  l11.includes("MATERIA QUE GOBIERNA ESTE CASO: Civil") && l11.includes("[ANOTACIÓN]") && !/%/.test(l11), l11);
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
// 18. resolverMateria sobre input realista civil (área declarada) para
//     confirmar que el pipeline no la pisa.
const r18 = M.resolverMateria("civil", "Nos notificaron la demanda civil el jueves 29 de octubre de 2026 mediante cedula. Indemnizacion de perjuicios.");
chk("18 draft civil: area declarada gana + conflicto null", r18.slug === "civil" && r18.conflicto === null && r18.origen === "declarada", r18);

// 19. getArticulosClave: null => []; transito => []; laboral sigue igual
const T = await import("../legalhelp-templates.js");
chk("19 getArticulosClave null-safe (nunca cae a laboral)",
  T.getArticulosClave(null).length === 0 && T.getArticulosClave("transito").length === 0 &&
  T.getArticulosClave("civil").length > 0 && T.getArticulosClave("laboral").length > 0,
  { n: T.getArticulosClave(null), t: T.getArticulosClave("transito") });

console.log(`\nQA Fase D: ${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
