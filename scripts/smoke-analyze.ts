// smoke-analyze.ts — prueba de humo LOCAL del endpoint /api/analyze con el
// caso real de construcción. Verifica: materia civil sin secundaria fantasma,
// sin acciones falsas, y marcas [VERIFICAR] en las citas del análisis.
import "dotenv/config";

const BASE = process.env.SMOKE_BASE || "http://localhost:3001";

const CASO_REAL = `Con fecha 15 de marzo de 2025, celebró un contrato de ejecución de obra a suma alzada con la demandada para la construcción de una nave industrial y dependencias corporativas en la comuna de Lampa. El plazo de entrega se fijó en 180 días corridos, bajo apercibimiento de una multa contractual de 50 UF por cada día de atraso. La obra presentaba un avance real de apenas un 62%, abandonando la demandada los trabajos el 30 de septiembre de 2025. Asimismo, peritajes técnicos posteriores constataron fallas estructurales graves en los radieres y techumbre derivados de la negligencia en la supervisión de los subcontratistas contratados por la constructora. Responsabilidad Contractual: La demandada ha incurrido en un incumplimiento grave de las obligaciones estipuladas en los artículos 1545 y 1556 del Código Civil, al no entregar la obra en el plazo convenido y presentar vicios constructivos. Responsabilidad por el Hecho del Dependiente: Conforme al artículo 2320 del Código Civil, la constructora responde directamente por las negligencias de sus subcontratistas y personal en obra. Daño Emergente: $85.000.000.- por concepto de reparaciones estructurales y término de obra con un tercero. Lucro Cesante: $42.000.000.- por rentas de arrendamiento no percibidas durante los meses de paralización. Multa Contractual: 1.500 UF acumuladas a la fecha.`;

async function main() {
  console.log(`Smoke contra ${BASE} con el caso real de construcción...\n`);
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userStory: CASO_REAL,
      documentText: "",
      notificationDate: "",
      audience: "abogado",
    }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log("materiaSlug:", data.materiaSlug);
  console.log("materia:", data.materia);
  console.log("materiaOrigen:", data.materiaOrigen);
  console.log("materiaSecundaria:", data.materiaSecundaria);
  console.log("cached:", data.cached);
  const analisis: string = data.analysis || "";
  console.log("\nlargo análisis:", analisis.length);
  const verificar = (analisis.match(/\[VERIFICAR\]/g) || []).length;
  console.log("marcas [VERIFICAR]:", verificar);
  console.log("menciona tránsito?:", /tránsito|transito|juzgado de polic/i.test(analisis) ? "⚠️ SÍ" : "no");
  console.log("menciona monitorio?:", /monitorio/i.test(analisis) ? "⚠️ SÍ" : "no");
  console.log("\n--- normas citadas (sección 2) ---");
  const sec2 = analisis.split(/##\s*2\./)[1]?.split(/##\s*3\./)[0] || "";
  console.log(sec2.slice(0, 1200));
  const fallos: string[] = [];
  if (data.materiaSlug !== "civil") fallos.push(`materia esperada civil, obtenida ${data.materiaSlug}`);
  if (data.materiaSecundaria) fallos.push(`secundaria fantasma: ${data.materiaSecundaria}`);
  if (verificar === 0) fallos.push("el análisis no trae marcas [VERIFICAR] en las citas");
  if (fallos.length) {
    console.error("\nFALLOS:", fallos.join(" | "));
    process.exit(1);
  }
  console.log("\nSMOKE LOCAL: OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
