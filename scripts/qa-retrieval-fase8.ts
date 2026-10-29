// QA Fase 8: calidad del retrieval jurisprudencial.
// (1) esFichaRelleno: ejemplos de la revision manual (34 casos auditados) ->
//     relleno clasificado y fichas dogmaticas reales intactas.
// (2) buscarJurisprudencia e2e con corpus real: consultas realisticas SIN relleno
//     en top-N cuando hay sustantivas; fallback si SOLO hay relleno.
// (3) bloquePromptJuris: contenido + operativaProcesal llegan al prompt, acotado.
// (4) buscarCasosJuris: las 6 semillas demo NUNCA salen en resultados.
import * as fs from "fs";
import { esFichaRelleno, buscarJurisprudencia, bloquePromptJuris, buscarCasosJuris, ROLES_SEMILLA_NO_CITABLES, bonusVentana } from "../jurisprudenciaChile.js";

// Paridad con prod (premium/draft corren con el corpus completo activo).
process.env.CORPUS_COMPLETO = "true";

let ok = 0, total = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  total++;
  console.log(`${total} ${nombre}: ${cond ? "PASS" : "FAIL"}`, detalle !== undefined ? JSON.stringify(detalle).slice(0, 220) : "");
  if (cond) ok++;
}

// (1) unidades de deteccion
const junk = [
  "Chequear diariamente el encendido y apagado",
  "Apertura de buzón de sugerencias, reclamos y",
  "Los actos de emulación; y",
  "Atender los llamados telefónicos y canalizarlos a",
  "Ejercer las demás funciones que le sean asignadas por el juez",
  "Pregunta: CUALES SON LAS GESTIONES PREPARATORIAS DE LA",
];
for (const inst of junk) check(`1 relleno detectado: "${inst.slice(0, 40)}"`, esFichaRelleno({ institucion: inst }) !== null);

const legitimas = [
  "El Principio Protector y sus Tres Vertientes Dogmáticas",
  "Teoría General de la Impugnación Procesal",
  "Medidas de resguardo",
  "Concepto y Catálogo de los Derechos Auxiliares",
  "Suministro de mano de obra",
];
for (const inst of legitimas) check(`1 legítima intacta: "${inst.slice(0, 40)}"`, esFichaRelleno({ institucion: inst }) === null);

// guard: con falloRector nunca es relleno
check("1 con falloRector nunca es relleno", esFichaRelleno({ institucion: "Chequear diariamente el encendido y apagado", falloRector: { rol: "1039-2025" } }) === null);

// (2) e2e con corpus real (base + full, igual que prod)
const consultas: Array<[string, string]> = [
  ["despido injustificado art. 161 necesidades de la empresa indemnización años de servicio", "laboral"],
  ["tutela laboral vulneración de derechos fundamentales Ley Karin acoso", "laboral"],
  ["notificación de la demanda y plazo para contestar arrendamiento", "civil"],
  ["alimentos y cuidado personal de los niños demanda", "familia"],
  ["recurso de protección acto arbitrario ilegal", "constitucional"],
  ["prescripción de multas por infracciones de tránsito", "administrativo"],
];
for (const [q, area] of consultas) {
  const r = await buscarJurisprudencia([q], 8, area);
  const conRelleno = r.filter(x => x.relleno);
  check(`2 top-8 sin relleno: ${q.slice(0, 45)}`, conRelleno.length === 0, { n: r.length, sustantivas: r.length - conRelleno.length });
  check(`2 sustantivas >= 4: ${q.slice(0, 45)}`, r.length - conRelleno.length >= 4, { n: r.length });
}
// fallback: el contrato real es (a) nunca vacio si hay match y (b) el relleno
// solo aparece DESPUES de las sustantivas (degradacion, no exclusion).
const rf = await buscarJurisprudencia(["atingente canalizarlos encendido apagado"], 8, "laboral");
check("2 fallback: nunca vacio si hay match", rf.length > 0, { n: rf.length });
const primerRelleno = rf.findIndex(x => x.relleno);
const sustantivaDespues = primerRelleno >= 0 ? rf.slice(primerRelleno + 1).some(x => !x.relleno) : false;
check("2 orden: relleno solo al final", !sustantivaDespues, { primerRelleno, n: rf.length });

// (3) bloque al prompt: contenido + operativa + cota
const bloque = bloquePromptJuris([
  {
    institucion: "El Principio Protector", materia: "Laboral", autor: "Gamonal", obra: "Derecho del Trabajo",
    falloRector: { rol: "12.450-2021", fecha: "11-05-2021", extra: "", raw: "" }, normas: ["CT art. 5"],
    dictamenes: [], definicion: "Matriz tutelar orientada a...".repeat(40),
    contenido: "Regla de la norma más favorable...".repeat(200),
    operativaProcesal: "Demandar ante el Juzgado de Letras del Trabajo dentro de 60 días hábiles.",
    relleno: false, puntuacion: 10,
  },
]);
check("3 bloque incluye operativaProcesal", bloque.includes("Operativa procesal:"));
check("3 bloque incluye contenido (900 chars)", bloque.includes("Contenido:") && bloque.includes("Regla de la norma más favorable"));
check("3 bloque acotado (<12000 chars, 1 ficha)", bloque.length < 12000, { chars: bloque.length });

// (4) semillas fuera de resultados
const casos = await buscarCasosJuris(["despido injustificado indemnización tutela acoso AFC"], 6);
const rolesSalidos = casos.map(c => c.rol);
check("4 semillas nunca en resultados", rolesSalidos.every(rol => !ROLES_SEMILLA_NO_CITABLES.has(rol)), { roles: rolesSalidos });
check("4 resultados con roles reales", casos.length > 0, { n: casos.length });

// (5) Fase 8b: ventana de proximidad + saturacion TF + dedup base/full.
// Valores medidos con scripts/_probe_proximidad.ts sobre el corpus real.
const idfStub = () => 4;
const blobCerca = "el plazo para contestar la demanda es de quince dias habiles";
const blobLejos = "plazo " + Array(14).fill("marcador").join(" ") + " contestar " + Array(14).fill("marcador").join(" ") + " demanda";
check("5 ventana: tokens cerca suman", bonusVentana(["plazo", "contestar", "demanda"], blobCerca, idfStub) > 0);
check("5 ventana: tokens lejos no suman", bonusVentana(["plazo", "contestar", "demanda"], blobLejos, idfStub) === 0);
check("5 ventana: cota maxima 8", bonusVentana(["plazo", "contestar", "demanda"], blobCerca, idfStub) <= 8);

// control e2e (antes: top-1 "Suministro de mano de obra" por TF sin saturar, 136 vs 115)
const rc = await buscarJurisprudencia(["despido injustificado art. 161 necesidades de la empresa indemnización"], 8, "laboral");
check("5 control: top-1 ficha correcta", (rc[0]?.institucion || "").includes("Necesidades de la Empresa"), { top1: (rc[0]?.institucion || "").slice(0, 60) });
const insts = rc.map(x => (x.institucion || "").trim().toLowerCase());
check("5 dedup: sin institucion repetida", new Set(insts).size === insts.length, { n: insts.length });

// formato de numero de ley (numero filtrado simetricamente; "karin" carry)
const rl = await buscarJurisprudencia(["requisitos de la ley 21.643 sobre acoso laboral"], 8, "laboral");
check("5 ley-formato: Karin en top-3", rl.slice(0, 3).some(x => (x.institucion || "").includes("Karin")), { top: rl.slice(0, 3).map(x => (x.institucion || "").slice(0, 40)) });

// parafrasis con verbo distinto (antes: "agentes quimicos" top-1)
const rv = await buscarJurisprudencia(["trabajador desvinculado sin causa justa indemnización años servidos"], 8, "laboral");
check("5 parabra: top-3 sin basura quimica", rv.slice(0, 3).every(x => !(x.institucion || "").includes("químicos")), { top1: (rv[0]?.institucion || "").slice(0, 60) });

console.log(`\nQA retrieval Fase 8: ${ok}/${total} PASS`);
process.exit(ok === total ? 0 : 1);