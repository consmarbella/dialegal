// probe-premium-prod.ts — informe PREMIUM de la demanda software/competencia
// desleal contra PROD: verifica fichas relevantes (sin Sociedad Conyugal),
// casos análogos sin fallback TC, corrección de cita 20.165→20.169 y BCN.
// Uso: npx tsx scripts/probe-premium-prod.ts [base]
import "dotenv/config";

const BASE = process.argv[2] || process.env.SMOKE_BASE || "https://legalhelp.cl";
const ADMIN_CODE = process.env.ADMIN_UNLOCK_CODE || "4321";

const DEMANDA = `SANTIAGO, 11 de noviembre de 2026

EN LO PRINCIPAL: Demanda en juicio ordinario de indemnización de perjuicios por infracción contractual y competencia desleal; PRIMER OTROSÍ: Acompaña documentos con citación y bajo apercibimiento; SEGUNDO OTROSÍ: Gestión preparatoria de exhibición de documentos; TERCER OTROSÍ: Patrocinio y poder.

SEÑOR JUEZ DE LETRAS EN LO CIVIL DE SANTIAGO

ALEJANDRO ANDRÉS MATTEUCCI PIZARRO, en representación de la sociedad CONSULTORÍAS EMPRESARIALES ALEJANDRO MATTEUCCI SpA, del giro de su denominación, ambos domiciliados para estos efectos en Américo Vespucio Norte 212, comuna de Lo Barnechea, Santiago, a US. respetuosamente digo:

II. INDIVIDUALIZACIÓN DE LA DEMANDADA: Viene en interponer demanda ordinaria de indemnización de perjuicios en contra de la sociedad TECNOLOGÍAS DIGITALES AVANZADAS S.A. (TECHNOVATION S.A.), RUT N° 77.123.456-8, representada legalmente por don GONZALO PÉREZ LARA, ambos domiciliados para estos efectos en Av. Vitacura N° 3560, oficina 1202, comuna de Vitacura, Santiago.

III. FUNDAMENTOS DE HECHO
1. Del Contrato de Desarrollo y Licenciamiento Tecnológico: Con fecha 10 de enero de 2025, mi representada celebró un contrato de desarrollo de software, integración de pasarelas de pago y arquitectura de infraestructura digital con la demandada Technovation S.A. Se fijó como contraprestación total la suma de $45.000.000.- pagaderos en estados de avance mensuales, con cláusulas de confidencialidad estricta y prohibición de ingeniería inversa o usufructo de los algoritmos propietarios.
2. Del Incumplimiento Contractual y Apropiación Indebida de Propiedad Intelectual: en agosto de 2025, la demandada detuvo unilateralmente los pagos correspondientes a los dos últimos hitos (equivalentes a $15.000.000.-) y, de manera subrepticia, utilizó la infraestructura desplegada para clonar el código fuente, lanzar un servicio competidor directo en el mercado chileno y rescindir el contrato bajo alegaciones infundadas.
3. De los Perjuicios: Daño Emergente $15.000.000.- más gastos de auditoría informática forense $4.500.000.-. Lucro Cesante $35.000.000.- por contratos de licenciamiento SaaS no percibidos. Daño Moral Corporativo / Reputacional $10.000.000.-.

IV. EL DERECHO
Responsabilidad Contractual (Artículos 1545, 1556 y 1558 del Código Civil). Responsabilidad Extracontractual y Competencia Desleal (Artículos 2314 y siguientes del Código Civil, en relación con la Ley N° 20.165 sobre Competencia Desleal): La apropiación de secretos industriales, códigos propietarios y la desviación fraudulenta de clientela constituye un ilícito civil extracontractual.

V. POR TANTO: condenar a la demandada al pago total de $64.500.000.-, con reajustes, intereses penales desde la fecha de mora y expresa condena en costas.`;

console.log(`\n=== PREMIUM demanda software/competencia desleal vs ${BASE} ===\n`);
const unlockRes = await fetch(`${BASE}/api/payment/admin-unlock`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: ADMIN_CODE }),
});
const unlockData = await unlockRes.json().catch(() => null);
if (!unlockRes.ok || !unlockData?.orderId) {
  console.error("admin-unlock falló:", unlockRes.status, JSON.stringify(unlockData).slice(0, 200));
  process.exit(1);
}
console.log("(orden cortesía:", unlockData.orderId + ")");

const res = await fetch(`${BASE}/api/premium-report`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderId: unlockData.orderId, userStory: DEMANDA, documentText: "", notificationDate: "", area: null }),
});
console.log("HTTP", res.status);
if (!res.ok) { console.error((await res.text()).slice(0, 300)); process.exit(1); }
const d = await res.json();
const r: string = d.report || "";

console.log("\n── MATERIA ──");
console.log("materia:", d.materia || d.materiaSlug, "| secundaria:", d.materiaSecundaria);

console.log("\n── BCN CITADOS ──");
for (const c of d.bcn?.citados || []) console.log(`✅ ${c.nombreNorma} Art. ${c.articulo}`);

console.log("\n── FICHAS JURISPRUDENCIALES (sección jurisprudencia del informe) ──");
const fichas = [...r.matchAll(/^.*?(Cláusula Penal|Mora del Deudor|Fuerza Obligatoria|Sociedad Conyugal|Daño Reparable|Cumplimiento Forzado|Sociedad por Acciones|Dolo Civil)[^\n]*$/gim)].map((m) => m[0].trim().slice(0, 110));
for (const f of fichas.slice(0, 10)) console.log(" •", f);
console.log("menciona Sociedad Conyugal:", /sociedad conyugal/i.test(r));
console.log("menciona régimen matrimonial/patrimonios:", /reg[ií]men\s+(?:de\s+)?bienes|estructura\s+trilateral/i.test(r));

console.log("\n── CASOS ANÁLOGOS ──");
const tcCases = /Tribunal Constitucional/gi;
const nTC = (r.match(tcCases) || []).length;
console.log("menciones 'Tribunal Constitucional':", nTC, "(esperado: 0 — eran el fallback cruzado)");
const pjSection = r.indexOf("Casos análogos");
if (pjSection >= 0) console.log("\nfragmento 'Casos análogos':\n", r.slice(pjSection, pjSection + 500).replace(/\n+/g, " | "));

console.log("\n── CORRECCIÓN 20.165→20.169 ──");
console.log("menciona 20.165:", r.includes("20.165"), "| menciona 20.169:", r.includes("20.169"));
const i = r.search(/20\.16[59]/);
if (i >= 0) console.log("fragmento:\n", r.slice(Math.max(0, i - 250), i + 350).replace(/\n+/g, " "));

console.log("\n── OTROS ──");
console.log("largo:", r.length, "| tránsito/JPL:", /(tránsito|policía local|JPL)/i.test(r), "| monitorio:", /monitorio/i.test(r));
console.log("secciones:", [/## 1\./, /## 2\./, /## 3\./, /## 4\./].map((re) => re.test(r)));
