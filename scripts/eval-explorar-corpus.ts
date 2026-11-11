import fs from "fs";
import path from "path";

// Explorar corpus-full para encontrar fichas con hechos suficientes
const files = ["laboral", "civil", "familia", "penal", "administrativo", "transito"];
const resumen: Record<string, any[]> = {};

for (const f of files) {
  const p = path.join("data", "corpus-full", `${f}.json`);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const fichas = data.fichas || [];
  const conRector = fichas.filter((x: any) => x.falloRector?.rol);
  const conContenido = conRector.filter((x: any) => (x.contenido || "").length > 200);
  const conNormas = conContenido.filter((x: any) => (x.normas || []).length > 0);
  console.log(`${f}: ${fichas.length} fichas | con falloRector: ${conRector.length} | con contenido>200: ${conContenido.length} | con normas: ${conNormas.length}`);
  // Mostrar 3 ejemplos
  const samples = conNormas.slice(0, 3).map((x: any) => ({
    id: x.id,
    institucion: (x.institucion || "").slice(0, 80),
    falloRector: x.falloRector?.rol,
    normas: (x.normas || []).slice(0, 3),
    definicion: (x.definicion || "").slice(0, 120),
    area: x.area,
  }));
  console.log("  muestras:", JSON.stringify(samples, null, 1).slice(0, 1200));
  resumen[f] = conNormas;
}
fs.writeFileSync("evaluation/evaluacion-fichas-candidatas.json", JSON.stringify(resumen, null, 2).slice(0, 1) + "[]");
