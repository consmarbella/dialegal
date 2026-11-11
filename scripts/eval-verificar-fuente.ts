import fs from "fs";
import path from "path";

const ref = JSON.parse(fs.readFileSync(path.join("evaluation", "evaluacion-ciega", "casos-referencia.json"), "utf-8"));
const areas = ["laboral", "civil", "transito"];
const corpus: any[] = [];
for (const a of areas) {
  const p = path.join("data", "corpus-full", `${a}.json`);
  if (fs.existsSync(p)) {
    const d = JSON.parse(fs.readFileSync(p, "utf-8"));
    corpus.push(...d.fichas);
  }
}
let ok = 0, fail = 0;
for (const r of ref) {
  const match = corpus.find((f: any) =>
    (f.falloRector?.rol === r.falloRector) || (f.institucion === r.institucion)
  );
  if (match) {
    const normasCorpus = (match.normas || []).map((n: string) => n.replace("BCN - ", ""));
    const coincide = JSON.stringify(normasCorpus) === JSON.stringify(r.normasEsperadas);
    if (coincide) {
      ok++;
      console.log(`OK ${r.id}: normas esperadas = corpus original`);
    } else {
      fail++;
      console.log(`DIFF ${r.id}:`);
      console.log(`  evaluacion: ${JSON.stringify(r.normasEsperadas)}`);
      console.log(`  corpus:     ${JSON.stringify(normasCorpus)}`);
    }
  } else {
    fail++;
    console.log(`NO ENCONTRADO ${r.id}: falloRector=${r.falloRector} institucion=${(r.institucion || "").slice(0, 60)}`);
  }
}
console.log(`Verificados contra corpus: ${ok}/${ref.length} | fallas: ${fail}`);
