import fs from "fs";
import path from "path";

// Runner de evaluación ciega: envía relatos a LegalHelp y compara contra referencia
// Sin ver la respuesta esperada antes de ejecutar

interface CasoRef {
  id: string;
  areaEsperada: string;
  institucion: string;
  falloRector: string | null;
  normasEsperadas: string[];
  relato: string;
  definicionOriginal: string;
  contenidoOriginal: string;
}

interface ResultadoEval {
  id: string;
  areaEsperada: string;
  areaObtenida: string | null;
  areaCorrecta: boolean;
  materiasSugeridas: string[];
  normasCitadas: string[];
  normasEsperadas: string[];
  normasCorrectas: string[];
  normasCompatibles: string[];
  normasIncorrectas: string[];
  normasSinVerificar: string[];
  // Análisis
  analisisTexto: string;
  analisisLargo: number;
  // Borrador
  borradorTexto: string;
  borradorLargo: number;
  tacticoDetectado: string[];
  // Evaluación
  evaluacionArticulos: "correcta" | "compatible" | "incorrecta" | "sin_verificar";
  // Marcadores
  tieneVerificar: boolean;
  // Score
  clasificacion: "correcto" | "correcto_con_ajustes" | "parcial" | "incorrecto" | "bloqueo_correcto" | "no_evaluable";
}

const casos: CasoRef[] = JSON.parse(fs.readFileSync("evaluation/evaluacion-ciega/casos-referencia.json", "utf-8"));

// Normalizar nombre de norma para comparación flexible
function normaNormalizada(n: string): string {
  return n.toLowerCase().replace(/art\.?\s*/g, "").replace(/\s+/g, " ").trim();
}

// Determinar si dos normas son compatibles (misma ley/código, tema relacionado)
function normaCompatible(esperada: string, citada: string): boolean {
  const e = normaNormalizada(esperada);
  const c = normaNormalizada(citada);
  // Mismo código/ley
  const codigosE = e.match(/(código|c[óo]digo|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*))/i);
  const codigosC = c.match(/(código|c[óo]digo|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*))/i);
  if (codigosE && codigosC) {
    const cuerpoE = codigosE[2].toLowerCase();
    const cuerpoC = codigosC[2].toLowerCase();
    if (cuerpoE === cuerpoC || cuerpoE.includes(cuerpoC) || cuerpoC.includes(cuerpoE)) return true;
  }
  // Mismo número de artículo en normas diferentes no es "compatible" a menos que sean el mismo cuerpo
  return false;
}

async function evaluarCaso(caso: CasoRef): Promise<ResultadoEval> {
  console.log(`\n[${caso.id}] Evaluando: ${caso.relato.slice(0, 80)}...`);

  // 1. Análisis (POST /api/analyze)
  let analisis = "";
  let materiaObtenida: string | null = null;
  let materiasSugeridas: string[] = [];
  try {
    const res = await fetch("http://localhost:3001/api/analyze", {
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
    if (data.error) {
      console.log(`  ERROR analyze: ${data.error}`);
      analisis = "";
    } else {
      analisis = data.analysis || "";
      materiaObtenida = data.materiaSlug || null;
      materiasSugeridas = data.materia ? [data.materia] : [];
      console.log(`  materia: ${materiaObtenida} | esperada: ${caso.areaEsperada}`);
    }
  } catch (e: any) {
    console.log(`  ERROR fetch analyze: ${e.message?.slice(0, 100)}`);
  }

  // 2. Borrador (POST /api/legalhelp/draft)
  let borrador = "";
  let tactico: any[] = [];
  try {
    const tipo = caso.areaEsperada === "laboral" || caso.areaEsperada === "civil" ? "contestacion" : "demanda";
    const postura = tipo === "contestacion" ? "demandado" : "demandante";
    const res = await fetch("http://localhost:3001/api/legalhelp/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        postura,
        hechos: caso.relato,
        pretensiones: ["Resolver el problema legal planteado"],
        area: caso.areaEsperada === "laboral" ? "laboral" : caso.areaEsperada === "civil" ? "civil" : undefined,
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log(`  ERROR draft: ${data.error}`);
    } else {
      borrador = data.draft || "";
      tactico = (data.tactico || []).map((t: any) => t.id);
      console.log(`  borrador: ${borrador.length} chars | táctico: ${tactico.length || "sin hallazgos"}`);
    }
  } catch (e: any) {
    console.log(`  ERROR fetch draft: ${e.message?.slice(0, 100)}`);
  }

  // 3. Extraer normas citadas del análisis + borrador
  const textoCompleto = analisis + "\n" + borrador;
  const normasCitadas: string[] = [];
  const normaRe = /(?:código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*)),?\s*(?:art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?))/gi;
  let m: RegExpExecArray | null;
  while ((m = normaRe.exec(textoCompleto)) !== null) {
    const cita = `Código ${m[1]}${m[2] ? ` Art. ${m[2]}` : ""}`;
    if (!normasCitadas.includes(cita)) normasCitadas.push(cita);
  }
  // También buscar citas directas de artículos
  const artRe = /art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?)\s*(?:del|de la|de)\s*(?:código|ley)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*))/gi;
  while ((m = artRe.exec(textoCompleto)) !== null) {
    const cita = `Código ${m[2]} Art. ${m[1]}`;
    if (!normasCitadas.includes(cita)) normasCitadas.push(cita);
  }

  // 4. Evaluar artículos contra esperadas
  const normasCorrectas: string[] = [];
  const normasCompatibles: string[] = [];
  const normasIncorrectas: string[] = [];
  let evaluacionArticulos: ResultadoEval["evaluacionArticulos"] = "sin_verificar";

  for (const esperada of caso.normasEsperadas) {
    const e = normaNormalizada(esperada);
    let encontrada = false;
    for (const citada of normasCitadas) {
      const c = normaNormalizada(citada);
      // Exacta: mismo código + mismo artículo
      if (c.includes(e) || e.includes(c)) {
        if (!normasCorrectas.includes(esperada)) normasCorrectas.push(esperada);
        encontrada = true;
        break;
      }
      // Compatible: mismo código/ley
      if (normaCompatible(esperada, citada)) {
        if (!normasCompatibles.includes(esperada)) normasCompatibles.push(esperada);
        encontrada = true;
        break;
      }
    }
    if (!encontrada && !normasIncorrectas.includes(esperada)) {
      // No encontrar una norma esperada no la hace incorrecta, solo sin verificar
      // Incorrecto = citar algo que NO existe
    }
  }

  // Verificar si citó algo incorrecto (que no existe en las esperadas ni es compatible)
  for (const citada of normasCitadas) {
    const c = normaNormalizada(citada);
    let esCorrecta = false;
    let esCompatible = false;
    for (const esperada of caso.normasEsperadas) {
      const e = normaNormalizada(esperada);
      if (c.includes(e) || e.includes(c)) { esCorrecta = true; break; }
      if (normaCompatible(esperada, citada)) { esCompatible = true; break; }
    }
    if (!esCorrecta && !esCompatible && !normasIncorrectas.includes(citada)) {
      normasIncorrectas.push(citada);
    }
  }

  if (normasCorrectas.length === caso.normasEsperadas.length) {
    evaluacionArticulos = "correcta";
  } else if (normasCorrectas.length + normasCompatibles.length >= caso.normasEsperadas.length * 0.5) {
    evaluacionArticulos = "compatible";
  } else if (normasIncorrectas.length > 0) {
    evaluacionArticulos = "incorrecta";
  }

  // 5. Verificar [VERIFICAR]
  const tieneVerificar = textoCompleto.includes("[VERIFICAR") || textoCompleto.includes("[SIN COBERTURA");

  // 6. Clasificación final
  const areaCorrecta =
    caso.areaEsperada === "laboral" ? (materiaObtenida === "laboral") :
    caso.areaEsperada === "civil" ? (materiaObtenida === "civil") :
    caso.areaEsperada === "familia" ? (materiaObtenida === "familia") :
    caso.areaEsperada === "transito" ? (materiaObtenida === "transito" || materiaObtenida === "administrativo") :
    materiaObtenida !== null;

  let clasificacion: ResultadoEval["clasificacion"];
  if (!analisis && !borrador) {
    clasificacion = "no_evaluable";
  } else if (normasIncorrectas.length > 0) {
    clasificacion = "incorrecto";
  } else if (areaCorrecta && evaluacionArticulos === "correcta" && tactico.length === 0) {
    clasificacion = "correcto";
  } else if (areaCorrecta && (evaluacionArticulos === "correcta" || evaluacionArticulos === "compatible")) {
    clasificacion = "correcto_con_ajustes";
  } else if (areaCorrecta) {
    clasificacion = "parcial";
  } else {
    clasificacion = "incorrecto";
  }

  return {
    id: caso.id,
    areaEsperada: caso.areaEsperada,
    areaObtenida: materiaObtenida,
    areaCorrecta,
    materiasSugeridas,
    normasCitadas,
    normasEsperadas: caso.normasEsperadas,
    normasCorrectas,
    normasCompatibles,
    normasIncorrectas,
    normasSinVerificar: caso.normasEsperadas.filter(n => !normasCorrectas.includes(n) && !normasCompatibles.includes(n)),
    analisisTexto: analisis.slice(0, 2000),
    analisisLargo: analisis.length,
    borradorTexto: borrador.slice(0, 2000),
    borradorLargo: borrador.length,
    tacticoDetectado: tactico,
    evaluacionArticulos,
    tieneVerificar,
    clasificacion,
  };
}

// Ejecutar
async function main() {
  console.log(`\n=== EVALUACIÓN CIEGA: ${casos.length} casos ===\n`);
  const resultados: ResultadoEval[] = [];

  for (const caso of casos) {
    const r = await evaluarCaso(caso);
    resultados.push(r);
    console.log(`  → ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} | normas: ${r.evaluacionArticulos} | verificar: ${r.tieneVerificar ? "✅" : "❌"}`);
  }

  // Resumen
  const resumen = {
    total: resultados.length,
    correcto: resultados.filter(r => r.clasificacion === "correcto").length,
    correcto_con_ajustes: resultados.filter(r => r.clasificacion === "correcto_con_ajustes").length,
    parcial: resultados.filter(r => r.clasificacion === "parcial").length,
    incorrecto: resultados.filter(r => r.clasificacion === "incorrecto").length,
    bloqueo_correcto: resultados.filter(r => r.clasificacion === "bloqueo_correcto").length,
    no_evaluable: resultados.filter(r => r.clasificacion === "no_evaluable").length,
    areaCorrecta: resultados.filter(r => r.areaCorrecta).length,
    areaIncorrecta: resultados.filter(r => !r.areaCorrecta).length,
    normasCorrectas: resultados.filter(r => r.evaluacionArticulos === "correcta").length,
    normasCompatibles: resultados.filter(r => r.evaluacionArticulos === "compatible").length,
    normasIncorrectas: resultados.filter(r => r.evaluacionArticulos === "incorrecta").length,
    normasSinVerificar: resultados.filter(r => r.evaluacionArticulos === "sin_verificar").length,
    conVerificar: resultados.filter(r => r.tieneVerificar).length,
    conTactico: resultados.filter(r => r.tacticoDetectado.length > 0).length,
  };

  console.log("\n=== RESUMEN ===");
  console.log(JSON.stringify(resumen, null, 2));

  // Guardar resultados
  fs.mkdirSync("evaluation/evaluacion-ciega/resultados", { recursive: true });
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resultados.json", JSON.stringify(resultados, null, 2));
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resumen.json", JSON.stringify(resumen, null, 2));

  // CSV
  const csv = [
    "id,areaEsperada,areaObtenida,areaCorrecta,clasificacion,normasCorrectas,normasCompatibles,normasIncorrectas,normasSinVerificar,tacticoDetectado,tieneVerificar,analisisLargo,borradorLargo",
    ...resultados.map(r => [r.id, r.areaEsperada, r.areaObtenida, r.areaCorrecta, r.clasificacion, r.normasCorrectas.length, r.normasCompatibles.length, r.normasIncorrectas.length, r.normasSinVerificar.length, r.tacticoDetectado.join(";"), r.tieneVerificar, r.analisisLargo, r.borradorLargo].join(","))
  ].join("\n");
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/resultados.csv", csv);

  // Reporte markdown
  const reporte = `# Evaluación Ciega LegalHelp

## Resumen
- Total casos: ${resumen.total}
- Correcto: ${resumen.correcto}
- Correcto con ajustes: ${resumen.correcto_con_ajustes}
- Parcial: ${resumen.parcial}
- Incorrecto: ${resumen.incorrecto}
- No evaluable: ${resumen.no_evaluable}

## Por dimensión
- Materia correcta: ${resumen.areaCorrecta}/${resumen.total}
- Normas correctas: ${resumen.normasCorrectas}
- Normas compatibles: ${resumen.normasCompatibles}
- Normas incorrectas: ${resumen.normasIncorrectas}
- Con [VERIFICAR]: ${resumen.conVerificar}
- Con control táctico: ${resumen.conTactico}

## Detalle por caso
${resultados.map(r => `- **${r.id}** [${r.areaEsperada}]: ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} | normas: ${r.evaluacionArticulos} | táctico: ${r.tacticoDetectado.length || "sin"}`).join("\n")}
`;
  fs.writeFileSync("evaluation/evaluacion-ciega/resultados/reporte_piloto.md", reporte);

  console.log("\nResultados guardados en evaluation/evaluacion-ciega/resultados/");
}

main();
