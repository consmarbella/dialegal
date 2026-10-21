import { buscarJurisprudencia } from "../jurisprudenciaChile";

async function main() {
  const q1 = "trabajador despedido por necesidades de la empresa con carta que solo invoca reestructuracion, sin antecedentes objetivos";
  const r = await buscarJurisprudencia([q1], 8);
  console.log("q1 total:", r.length);
  for (const x of r.slice(0, 8)) {
    console.log(`- [${x.puntuacion}] ${x.institucion} | ${x.obra.slice(0, 60)} | Rol ${x.falloRector?.rol}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
