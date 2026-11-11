import fs from "fs";

const raw = JSON.parse(fs.readFileSync("data/jurisprudencia-casos.json", "utf-8"));
const arr = Array.isArray(raw) ? raw : (raw.casos || []);
console.log("Total casos:", arr.length);
const sample = arr.slice(0, 2).map(c => JSON.stringify(c).slice(0, 400));
console.log("Muestra:", sample.join("\n---\n"));
const materias: Record<string, number> = {};
for (const c of arr) {
  const m = String(c.materia || "").trim().slice(0, 40);
  if (m) materias[m] = (materias[m] || 0) + 1;
}
const sorted = Object.entries(materias).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log("Top 20 materias:", JSON.stringify(sorted, null, 2));
