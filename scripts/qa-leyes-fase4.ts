// QA Fase 4: resolutor genérico + cruce artículo<->norma.
// DB de prueba: docker pg-fase2-test. Casos:
// 1) extraerCitadasPorNorma: "Art. N" tras "Ley 18.290" -> par con L18290.
// 2) Ley genérica FUERA de la semilla (21.430, aprobación unilateral contratos
//    de leasing -> idNorma real) -> verificado con texto de artículo.
// 3) Ley inexistente/DFL genérico -> pendiente norma_no_resoluble.
// 4) Verificar direct Ley 18.290 (semilla).
process.env.DATABASE_URL = "postgres://postgres:testonly@127.0.0.1:55432/postgres";
const { extraerCitadasPorNorma, verificarCitasBCN } = await import("../bcnLeyChile.js");

const tx = `El art. 1 de la Ley 21.430 garantiza el interés superior del niño. Ademas,
cabe recordar que el Art. 1002 del vigente pacto opera la prescripción de las acciones,
siendo aplicable además Ley 18.290, art. 157. La multa descansa en el DFL 999 de 2099.`;

// ---- parte deterministica
const ex = extraerCitadasPorNorma(tx);
console.log("A normas detectadas:", ex.normas.map(n => `${n.key}(res=${n.resuelta},idx=${n.idx})`).join(" "));
console.log("A pares:", ex.pares.map(p => `${p.num}@${p.idx}->${p.norma ? p.norma.key : "SIN-NORMA"}`).join(" | "));

// ---- con red
const t0 = Date.now();
const v = await verificarCitasBCN([tx]);
console.log("B en", Date.now() - t0, "ms");
for (const a of v.verificados) {
  console.log("B verif:", a.nombreNorma, "Art", a.articulo, "| url idNorma=" + a.idNorma, "| texto:", a.texto.slice(0, 60).replace(/\n/g, " "));
}
for (const p of v.pendientes) {
  console.log("B pend :", p.nombreNorma, "| arts", p.articulosPedidos.join(","), "| motivo:", p.motivo, "| idNorma:", p.idNorma);
}

// ── 2026-11-02: semilla ampliada (42 normas) — pareo offline de artículos ───
// Sin red: cada cita canónica debe parear su artículo con la clave esperada
// (extraerCitadasPorNorma es puro). Incluye los códigos/DFL que ANTES caían en
// norma_no_resoluble y las leyes citadas por NOMBRE que antes no se detectaban.
let okS = 0, failS = 0;
function chkSemilla(name: string, cond: boolean, data?: unknown) {
  if (cond) { okS++; console.log(`S ${okS + failS} ${name}: PASS`); }
  else { failS++; console.log(`S ${okS + failS} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}
const pareos: Array<[string, string, string]> = [
  ["CTrib", "Código Tributario", "21"],
  ["L18834", "Estatuto Administrativo", "61"],
  ["L18883", "Estatuto Administrativo Municipal", "5"],
  ["L19496", "Ley del Consumidor", "3"],
  ["L21643", "Ley Karin", "3"],
  ["L21561", "Ley de 40 Horas", "3"],
  ["L20000", "Ley de Drogas", "4"],
  ["L20066", "Ley de Violencia Intrafamiliar", "8"],
  ["L19947", "Ley de Matrimonio Civil", "54"],
  ["L16744", "Ley de Accidentes del Trabajo", "3"],
  ["L19300", "Ley de Bases Generales del Medio Ambiente", "2"],
  ["L19886", "Ley de Compras Públicas", "8"],
  ["L18046", "Ley de Sociedades Anónimas", "110"],
  ["L21719", "Ley 21.719", "9"],
  ["CSan", "Código Sanitario", "6"],
  ["CAguas", "Código de Aguas", "14"],
  ["CMiner", "Código de Minería", "2"],
  ["CCom", "Código de Comercio", "14"],
  ["CJM", "Código de Justicia Militar", "74"],
  ["CAero", "Código Aeronáutico", "5"],
  ["LGUC", "Ley General de Urbanismo y Construcciones", "116"],
];
for (const [key, nombre, art] of pareos) {
  const r = extraerCitadasPorNorma(`Se cita ${nombre} artículo ${art} para el caso.`);
  const par = r.pares.find((p) => p.norma && p.norma.key === key);
  chkSemilla(`pareo ${key} (${nombre} art. ${art})`,
    !!par && par.num === art,
    r.pares.map((p) => `${p.num}->${p.norma ? p.norma.key : "SIN-NORMA"}`).join(", ") || "(sin pares)");
}
// hardening DFL: pelados no resuelven; con denominador sí (idNorma correcto)
const dfl1 = extraerCitadasPorNorma("La multa se rige por el DFL N° 1 de 1968, art. 5.");
chkSemilla("negativo: 'DFL N° 1' pelado NO resuelve CC", !dfl1.normas.some((n) => n.key === "CC"), dfl1.normas.map((n) => n.key));
const dfl2 = extraerCitadasPorNorma("La multa se rige por el DFL N° 2 de 1968, art. 5.");
chkSemilla("negativo: 'DFL N° 2' pelado NO resuelve CT", !dfl2.normas.some((n) => n.key === "CT"), dfl2.normas.map((n) => n.key));
const dfl2b = extraerCitadasPorNorma("La multa se rige por el DFL 2 de 2003, art. 5.");
chkSemilla("positivo: 'DFL 2 de 2003' resuelve CT", dfl2b.normas.some((n) => n.key === "CT" && n.resuelta && n.idNorma === 207436), dfl2b.normas.map((n) => `${n.key}(id=${n.idNorma})`));
// LEY_EXTRA corregida: por número resuelve al idNorma REAL, no al número de ley
const aer = extraerCitadasPorNorma("El código se aplica por la Ley 18.916 art. 5.");
const aerHit = aer.normas.find((n) => n.key === "LEY18916");
chkSemilla("LEY_EXTRA: 'Ley 18.916' -> idNorma 30287 (antes 18916 = decreto ajeno)", !!aerHit && aerHit.resuelta && aerHit.idNorma === 30287, aer.normas.map((n) => `${n.key}(id=${n.idNorma})`));

console.log(`\nSEMILLA AMPLIADA (offline): ${okS} pass, ${failS} fail`);
if (failS > 0) process.exit(1);
