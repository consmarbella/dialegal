import { verificarCitasBCN, bloquePromptBCN } from "../bcnLeyChile";

async function main() {
  const textos = [
    `El trabajador fue despedido el 15 de enero de 2026. Conforme al artículo 161 del Código del trabajo y al artículo 162 inciso cuarto del mismo cuerpo, ` +
      `la remuneración pendiente devenga intereses conforme al artículo 6° bis del DFL 2, el que remite al Código Civil. ` +
      `Además, el artículo 98 del Código del Trabajo regula el registro de asistencia.`,
    `En materia de multas de tránsito, el artículo 13° de la Ley 18.290 regula los exámenes médicos de conductores; ` +
      `la precitada ley también se relaciona con el artículo 167 en cuanto a revocación de licencias.`,
    `El arriendo termina conforme al artículo 595 del Código de Procedimiento Civil y al artículo 22 de la Ley 18.101, ` +
      `y la pensión alimenticia se rige por el artículo 6° de la Ley 14.908. También citamos el artículo 233 bis de la Ley 18.290 (no existe).`,
    `Cita a una ley distópica: artículo 4 de la Ley 21.547 (fuera de la tabla).`,
  ];
  const res = await verificarCitasBCN(textos);
  console.log("=== VERIFICADOS ===");
  for (const a of res.verificados) {
    console.log(`- ${a.nombreNorma} Art.${a.articulo} vigente=${a.vigente} fv=${a.fechaVersion || "-"} len=${a.texto.length}`);
    console.log(`  ${(a.texto.slice(0, 110)).replace(/\n/g, " | ")}`);
    console.log(`  url=${a.url}`);
  }
  console.log("\n=== PENDIENTES ===");
  for (const p of res.pendientes) console.log(`- ${p.nombreNorma} arts=[${p.articulosPedidos.join(",")}] motivo=${p.motivo}`);
  console.log("\n=== BLOQUE PROMPT (primeros 1400 chars) ===");
  console.log(bloquePromptBCN(res).slice(0, 1400));
}

main().catch((e) => { console.error(e); process.exit(1); });
