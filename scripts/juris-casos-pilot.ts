// Piloto del indice de CASOS análogos (sin LLM): valida scoring sobre
// data/jurisprudencia-casos.json (CS/TC, doctrina cosechada).
// Uso: npx tsx scripts/juris-casos-pilot.ts [consulta]
import { buscarCasosJuris } from "../jurisprudenciaChile.js";

const consulta = process.argv[2] || "despido por necesidades de la empresa con carta sin hechos concretos";

async function main() {
  const casos = await buscarCasosJuris([consulta]);
  console.log(`Consulta: "${consulta}"`);
  console.log(`Casos recuperados: ${casos.length}`);
  for (const c of casos.slice(0, 4)) {
    console.log(`\n- [${c.tipo}] ${c.tribunal} · ${c.sala || "sin sala"} | ${c.rol} (${c.fecha || "s/f"}) | score=${c.puntuacion}`);
    console.log(`  materia: ${c.materia}`);
    console.log(`  doctrina: ${(c.doctrina || "").slice(0, 180)}`);
    if (c.normas) console.log(`  normas: ${c.normas}`);
    if (c.link) console.log(`  link: ${c.link}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
