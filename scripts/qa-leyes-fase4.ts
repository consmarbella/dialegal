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
