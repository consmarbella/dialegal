// probe-demanda-prod.ts — caso real software/competencia desleal contra PROD.
// Verifica: materia civil, Ley 20.169 en el pie BCN (semilla por materia) y si
// el informe señala el error de cita 20.165→20.169. Uso:
//   npx tsx scripts/probe-demanda-prod.ts [base]
import "dotenv/config";

const BASE = process.argv[2] || process.env.SMOKE_BASE || "https://legalhelp.cl";

const DEMANDA = `SANTIAGO, 11 de noviembre de 2026

EN LO PRINCIPAL: Demanda en juicio ordinario de indemnización de perjuicios por infracción contractual y competencia desleal; PRIMER OTROSÍ: Acompaña documentos con citación y bajo apercibimiento; SEGUNDO OTROSÍ: Gestión preparatoria de exhibición de documentos; TERCER OTROSÍ: Patrocinio y poder.

SEÑOR JUEZ DE LETRAS EN LO CIVIL DE SANTIAGO

ALEJANDRO ANDRÉS MATTEUCCI PIZARRO, en representación de la sociedad CONSULTORÍAS EMPRESARIALES ALEJANDRO MATTEUCCI SpA, del giro de su denominación, ambos domiciliados para estos efectos en Américo Vespucio Norte 212, comuna de Lo Barnechea, Santiago, a US. respetuosamente digo:

II. INDIVIDUALIZACIÓN DE LA DEMANDADA: Viene en interponer demanda ordinaria de indemnización de perjuicios en contra de la sociedad TECNOLOGÍAS DIGITALES AVANZADAS S.A. (TECHNOVATION S.A.), RUT N° 77.123.456-8, representada legalmente por don GONZALO PÉREZ LARA, ambos domiciliados para estos efectos en Av. Vitacura N° 3560, oficina 1202, comuna de Vitacura, Santiago.

III. FUNDAMENTOS DE HECHO
1. Del Contrato de Desarrollo y Licenciamiento Tecnológico: Con fecha 10 de enero de 2025, mi representada celebró un contrato de desarrollo de software, integración de pasarelas de pago y arquitectura de infraestructura digital con la demandada Technovation S.A., destinado a implementar un motor determinístico de procesamiento de datos y optimización de campañas. Se fijó como contraprestación total la suma de $45.000.000.- pagaderos en estados de avance mensuales, estableciéndose cláusulas de confidencialidad estricta y prohibición de ingeniería inversa o usufructo de los algoritmos propietarios desarrollados por mi mandante.

2. Del Incumplimiento Contractual y Apropiación Indebida de Propiedad Intelectual: Durante los meses de ejecución, mi representada entregó los códigos fuente, diagramas de arquitectura y módulos funcionales conforme a los estándares acordados. Sin embargo, en agosto de 2025, la demandada detuvo unilateralmente los pagos correspondientes a los dos últimos hitos (equivalentes a $15.000.000.-) y, de manera subrepticia, utilizó la infraestructura desplegada en los servidores de prueba para clonar el código fuente, lanzar un servicio competidor directo en el mercado chileno y rescindir el contrato bajo alegaciones infundadas de "retraso técnico imputable al desarrollador".

3. De los Perjuicios Ocasionados: El actuar doloso y culpable de la demandada ha causado un grave detrimento patrimonial y comercial a mi representada: Daño Emergente: costos directos devengados y no pagados por los hitos ejecutados, tasados en $15.000.000.-, además de gastos de auditoría informática forense pericial por $4.500.000.-. Lucro Cesante: proyecciones de ingresos netos de los contratos de licenciamiento SaaS que mi representada dejó de percibir durante los siguientes 12 meses, tasados prudentemente en $35.000.000.-. Daño Moral Corporativo / Reputacional: afectación grave al prestigio comercial de la consultora frente a inversionistas y clientes institucionales, ascendente a $10.000.000.-.

IV. EL DERECHO
La presente acción se funda en las siguientes normas legales e institucionales:
Responsabilidad Contractual (Artículos 1545, 1556 y 1558 del Código Civil): Todo contrato legalmente celebrado es una ley para los contratantes, y su incumplimiento culpable o doloso obliga a la indemnización de los perjuicios.
Responsabilidad Extracontractual y Competencia Desleal (Artículos 2314 y siguientes del Código Civil, en relación con la Ley N° 20.165 sobre Competencia Desleal): La apropiación de secretos industriales, códigos propietarios y la desviación fraudulenta de clientela constituye un ilícito civil extracontractual que genera el deber de reparar íntegramente el daño causado.

V. POR TANTO,
A US. RUEGO: Se sirva tener por interpuesta demanda ordinaria de indemnización de perjuicios en contra de TECNOLOGÍAS DIGITALES AVANZADAS S.A. (TECHNOVATION S.A.), acogerla a tramitación, y en definitiva condenar a la demandada al pago total de $64.500.000.-, con reajustes, intereses penales desde la fecha de mora y expresa condena en costas.`;

console.log(`\n=== DEMANDA SOFTWARE/COMPETENCIA DESLEAL contra ${BASE}/api/analyze ===\n`);
const res = await fetch(`${BASE}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userStory: DEMANDA, documentText: "", notificationDate: "", audience: "abogado" }),
});
console.log("HTTP", res.status);
if (!res.ok) { console.log((await res.text()).slice(0, 300)); process.exit(1); }
const d = await res.json();
const a: string = d.analysis || "";

console.log("\n── MATERIA ──");
console.log("materiaSlug:", d.materiaSlug, "| secundaria:", d.materiaSecundaria, "| origen:", d.materiaOrigen ?? "?");

console.log("\n── PIE BCN (resumen del JSON) ──");
const bcn = d.bcn || null;
if (bcn?.verificados) {
  for (const v of bcn.verificados) console.log(`✅ ${v.nombreNorma} Art. ${v.articulo}${v.viaSemilla ? " [SEMILLA-materia]" : ""}`);
} else console.log("(sin campo bcn)");

console.log("\n── CORRECCIÓN DE CITA 20.165→20.169 en el texto del informe ──");
const menciona20165 = a.includes("20.165");
const menciona20169 = a.includes("20.169");
const mencionaCorreccion = /20\.165[^]{0,400}?20\.169|20\.169[^]{0,400}?20\.165|(corr?ecci[oó]n|error|equi[vv]ocad|mal citad|no corresponde)[^]{0,200}?20\.16[59]/i.test(a);
console.log("menciona 20.165:", menciona20165, "| menciona 20.169:", menciona20169, "| señala corrección/error:", mencionaCorreccion);
if (menciona20165 || menciona20169) {
  const idxs: number[] = [];
  let m: RegExpExecArray | null;
  const re = /20\.16[59]/g;
  while ((m = re.exec(a)) !== null) idxs.push(m.index);
  for (const i of idxs.slice(0, 4)) {
    console.log(`\n>>> fragmento @${i}:\n${a.slice(Math.max(0, i - 260), i + 260).replace(/\n+/g, " ")}`);
  }
}

console.log("\n── FICHAS JURISPRUDENCIALES CITADAS (detección de irrelevantes) ──");
const conyugal = /sociedad conyugal|patrimonios|reg[ií]men.*(matrimon|bienes)/i.test(a);
console.log("menciona Sociedad Conyugal/régimen matrimonial (debería ser NO):", conyugal);

console.log("\n── OTROS ──");
console.log("tránsito/JPL:", /(tránsito|policía local|JPL)/i.test(a), "| monitorio:", /monitorio/i.test(a));
console.log("[VERIFICAR] count:", (a.match(/\[VERIFICAR\]/g) || []).length);
console.log("\nlargo análisis:", a.length);
