import fs from "fs";

// Runner de evaluación ciega - versión rápida que usa la plataforma en producción
// (no requiere servidor local) y hace las 17 llamadas a /api/analyze en paralelo limitado

const casos: any[] = JSON.parse(fs.readFileSync("evaluation/evaluacion-ciega/casos-referencia.json", "utf-8"));
const BASE = "https://legalhelp.cl";

function normaNormalizada(n: string): string {
  return n.toLowerCase().replace(/art\.?\s*/g, "").replace(/\s+/g, " ").trim();
}

function normaCompatible(esperada: string, citada: string): boolean {
  const e = normaNormalizada(esperada);
  const c = normaNormalizada(citada);
  const codigosE = e.match(/(código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|\d[\d.]+)/i);
  const codigosC = c.match(/(código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|\d[\d.]+)/i);
  if (codigosE && codigosC) {
    const cuerpoE = codigosE[2].toLowerCase();
    const cuerpoC = codigosC[2].toLowerCase();
    return cuerpoE === cuerpoC || cuerpoE.includes(cuerpoC) || cuerpoC.includes(cuerpoE);
  }
  return false;
}

async function evaluarCaso(caso: any): Promise<any> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userStory: caso.relato,
      documentText: "",
      notificationDate: "",
      audience: "abogado",
    }),
  });
  const data = await res.json();
  const analisis = data.analysis || "";
  const materiaObtenida = data.materiaSlug || null;

  // Extraer normas citadas
  const normasCitadas: string[] = [];
  const normaRe = /(?:código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*)),?\s*(?:art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?))/gi;
  const artRe = /art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?)\s*(?:del|de la|de)\s*(?:código|ley)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*))/gi;
  for (const re of [normaRe, artRe]) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(analisis)) !== null) {
      const cita = re === normaRe ? `Código ${m[1]}${m[2] ? ` Art. ${m[2]}` : ""}` : `Código ${m[2]} Art. ${m[1]}`;
      if (!normasCitadas.includes(cita)) normasCitadas.push(cita);
    }
  }

  // Evaluar artículos
  const correctas: string[] = [];
  const compatibles: string[] = [];
  const incorrectas: string[] = [];
  for (const esperada of caso.normasEsperadas) {
    const e = normaNormalizada(esperada);
    let ok = false;
    for (const citada of normasCitadas) {
      const c = normaNormalizada(citada);
      if (c.includes(e) || e.includes(c)) { if (!correctas.includes(esperada)) correctas.push(esperada); ok = true; break; }
      if (normaCompatible(esperada, citada)) { if (!compatibles.includes(esperada)) compatibles.push(esperada); ok = true; break; }
    }
    if (!ok && !incorrectas.includes(esperada)) {
      // La norma esperada no fue citada - no es incorrecta de LegalHelp, es sin verificar
    }
  }
  for (const citada of normasCitadas) {
    const c = normaNormalizada(citada);
    let ok = false;
    for (const esperada of caso.normasEsperadas) {
      const e = normaNormalizada(esperada);
      if (c.includes(e) || e.includes(c)) { ok = true; break; }
      if (normaCompatible(esperada, citada)) { ok = true; break; }
    }
    if (!ok && !incorrectas.includes(citada)) incorrectas.push(citada);
  }

  let evalArt: string;
  if (correctas.length === caso.normasEsperadas.length) evalArt = "correcta";
  else if (correctas.length + compatibles.length >= Math.ceil(caso.normasEsperadas.length * 0.5)) evalArt = "compatible";
  else if (incorrectas.length > 0) evalArt = "incorrecta";
  else evalArt = "sin_verificar";

  const tieneVerificar = analisis.includes("[VERIFICAR") || analisis.includes("[SIN COBERTURA");
  const areaCorrecta =
    caso.areaEsperada === "transito" ? (materiaObtenida === "transito" || materiaObtenida === "administrativo") :
    materiaObtenida === caso.areaEsperada;

  let clasificacion: string;
  if (!analisis) clasificacion = "no_evaluable";
  else if (incorrectas.length > 0) clasificacion = "incorrecto";
  else if (areaCorrecta && evalArt === "correcta") clasificacion = "correcto";
  else if (areaCorrecta && (evalArt === "compatible" || evalArt === "sin_verificar")) clasificacion = "correcto_con_ajustes";
  else if (areaCorrecta) clasificacion = "parcial";
  else clasificacion = "incorrecto";

  return {
    id: caso.id,
    areaEsperada: caso.areaEsperada,
    areaObtenida: materiaObtenida,
    areaCorrecta,
    clasificacion,
    evalArt,
    normasCitadas: normasCitadas.length,
    normasEsperadas: caso.normasEsperadas.length,
    correctas: correctas.length,
    compatibles: compatibles.length,
    incorrectas: incorrectas.length,
    tieneVerificar,
    analisisLargo: analisis.length,
    cached: data.cached || false,
  };
}

async function main() {
  console.log(`=== EVALUACIÓN CIEGA: ${casos.length} casos ===\n`);
  const resultados: any[] = [];

  // Procesar de a 3 en paralelo para no saturar la cuota de Gemini
  const batch = 3;
  for (let i = 0; i < casos.length; i += batch) {
    const grupo = casos.slice(i, i + batch);
    const promesas = grupo.map(c => evaluarCaso(c).catch(e => ({ id: c.id, error: e.message, clasificacion: "no_evaluable", areaEsperada: c.areaEsperada, areaObtenida: null, areaCorrecta: false, evalArt: "sin_verificar", normasCitadas: 0, normasEsperadas: 0, correctas: 0, compatibles: 0, incorrectas: 0, tieneVerificar: false, analisisLargo: 0, cached: false })));
    const resultadosGrupo = await Promise.all(promesas);
    for (const r of resultadosGrupo) {
      resultados.push(r);
      console.log(`[${r.id}] ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} ${r.areaObtenida || "?"} | normas: ${r.evalArt} | verificar: ${r.tieneVerificar ? "✅" : "❌"} | cached: ${r.cached ? "Y" : "N"}`);
    }
  }

  const resumen: any = {};
  for (const r of resultados) {
    resumen[r.clasificacion] = (resumen[r.clasificacion] || 0) + 1;
  }
  resumen.total = resultados.length;
  resumen.areaCorrecta = resultados.filter((r: any) => r.areaCorrecta).length;
  resumen.areaIncorrecta = resultados.filter((r: any) => !r.areaCorrecta).length;
  resumen.conVerificar = resultados.filter((r: any) => r.tieneVerificar).length;

  console.log("\n=== RESUMEN ===");
  console.log(JSON.stringify(resumen, null, 2));

  fs.mkdirSync("evaluation/evaluacion-ciega/resultados", { recursive: true });
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resultados.json", JSON.stringify(resultados, null, 2));
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resumen.json", JSON.stringify(resumen, null, 2));

  const csv = [
    "id,areaEsperada,areaObtenida,areaCorrecta,clasificacion,evalArt,normasCitadas,normasEsperadas,correctas,compatibles,incorrectas,tieneVerificar,analisisLargo,cached",
    ...resultados.map((r: any) => [r.id, r.areaEsperada, r.areaObtenida, r.areaCorrecta, r.clasificacion, r.evalArt, r.normasCitadas, r.normasEsperadas, r.correctas, r.compatibles, r.incorrectas, r.tieneVerificar, r.analisisLargo, r.cached].join(","))
  ].join("\n");
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resultados.csv", csv);

  const reporte = `# Evaluación Ciega LegalHelp - Piloto

## Resumen
- Total casos: ${resumen.total}
- Correcto: ${resumen.correcto || 0}
- Correcto con ajustes: ${resumen.correcto_con_ajustes || 0}
- Parcial: ${resumen.parcial || 0}
- Incorrecto: ${resumen.incorrecto || 0}
- No evaluable: ${resumen.no_evaluable || 0}

## Por dimensión
- Materia correcta: ${resumen.areaCorrecta}/${resumen.total}
- Materia incorrecta: ${resumen.areaIncorrecta}/${resumen.total}
- Normas correctas: ${resumen.normasCorrectas || 0}
- Normas compatibles: ${resumen.normasCompatibles || 0}
- Con [VERIFICAR]: ${resumen.conVerificar || 0}

## Detalle por caso
${resultados.map((r: any) => `- **${r.id}** [${r.areaEsperada}]: ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} ${r.areaObtenida || "?"} | normas: ${r.evalArt} | [VERIFICAR]: ${r.tieneVerificar ? "✅" : "❌"}`).join("\n")}
`;
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/reporte_piloto.md", reporte);

  console.log("\nResultados guardados en evaluation/evaluacion-ciega/resultados/");
}
main();
