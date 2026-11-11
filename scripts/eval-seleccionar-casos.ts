import fs from "fs";
import path from "path";

// Seleccionar 20 casos representativos del corpus para evaluación ciega
// Criterios: falloRector disponible, contenido narrable, normas citadas
// 10 laborales + 5 civiles + 3 familia + 2 tránsito

const files = ["laboral", "civil", "familia", "transito"];
const seleccion: any[] = [];

for (const f of files) {
  const p = path.join("data", "corpus-full", `${f}.json`);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const fichas = (data.fichas || []).filter((x: any) =>
    x.falloRector?.rol &&
    (x.contenido || "").length > 150 &&
    (x.normas || []).length > 0 &&
    (x.definicion || "").length > 50
  );
  console.log(`${f}: ${fichas.length} candidatas`);
  seleccion.push(...fichas.slice(0, f === "laboral" ? 10 : f === "civil" ? 8 : f === "familia" ? 4 : 4));
}

console.log(`Total seleccionadas: ${seleccion.length}`);

// Generar las entradas de evaluación
const casos = seleccion.map((f, i) => {
  const area = f.area?.toLowerCase().includes("laboral") ? "laboral" :
    f.area?.toLowerCase().includes("civil") ? "civil" :
    f.area?.toLowerCase().includes("famili") ? "familia" :
    f.area?.toLowerCase().includes("tránsito") || f.area?.toLowerCase().includes("transito") ? "transito" :
    f.area?.toLowerCase().includes("penal") ? "penal" : "administrativo";

  return {
    id: `E${String(i + 1).padStart(3, "0")}`,
    areaEsperada: area,
    falloRector: f.falloRector?.rol || "",
    normasEsperadas: (f.normas || []).map((n: string) => n.replace("BCN - ", "")),
    institucion: f.institucion,
    definicion: f.definicion,
    // Guardar el contenido original para referencia (NO se envía a LegalHelp)
    contenidoOriginal: f.contenido,
    operativaProcesal: f.operativaProcesal,
  };
});

// Guardar
fs.mkdirSync("evaluation/evaluacion-ciega", { recursive: true });
fs.writeFileSync("evaluation/evaluacion-ciega/casos-referencia.json", JSON.stringify(casos, null, 2));
console.log(`Guardados ${casos.length} casos en evaluation/evaluacion-ciega/casos-referencia.json`);

// Mostrar resumen
for (const c of casos.slice(0, 5)) {
  console.log(`${c.id} [${c.areaEsperada}] ${c.institucion?.slice(0, 60)} | normas: ${c.normasEsperadas.slice(0, 2).join(", ")}`);
}
