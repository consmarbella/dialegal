// Auditoría ciega v2: 16 casos con relatos únicos escritos a mano.
// Ejecuta cada uno contra /api/analyze en producción y compara
// contra la referencia del corpus (sin que yo vea la respuesta antes).

import fs from "fs";
import path from "path";

interface CasoRef {
  id: string;
  areaEsperada: string;
  institucion: string;
  falloRector: string | null;
  normasEsperadas: string[];
  relato: string;
}

const casos: CasoRef[] = JSON.parse(fs.readFileSync("evaluation/evaluacion-ciega-v2/casos-referencia.json", "utf-8"));
const BASE = "https://legalhelp.cl";

function normaNorm(n: string): string {
  return n.toLowerCase().replace(/art\.?\s*/g, "").replace(/\s+/g, " ").trim();
}

function normaCompat(e: string, c: string): boolean {
  const cuerpoE = e.match(/(código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|\d[\d.]+)/i);
  const cuerpoC = c.match(/(código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|\d[\d.]+)/i);
  if (cuerpoE && cuerpoC) {
    const ce = cuerpoE[2].toLowerCase(), cc = cuerpoC[2].toLowerCase();
    return ce === cc || ce.includes(cc) || cc.includes(ce);
  }
  return false;
}

async function evaluar(caso: CasoRef): Promise<any> {
  // 1. Análisis
  let analisis = "", materiaObtenida: string | null = null, materiaSecundaria: string | null = null, acciones: string[] = [];
  try {
    const res = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userStory: caso.relato, documentText: "", notificationDate: "", audience: "abogado" }),
    });
    const data = await res.json();
    analisis = data.analysis || "";
    materiaObtenida = data.materiaSlug || null;
    materiaSecundaria = data.materiaSecundaria || null;
    // Extraer acciones detectadas del texto
    const accRe = /acciones detectadas[:\s]*([^\n]+)/i;
    const am = (data.analysis || "").match(accRe);
    if (am) acciones = am[1].split("·").map((s: string) => s.trim());
    else if (data.documentos?.acciones) acciones = data.documentos.acciones;
  } catch (e: any) {
    console.log(`  ERROR analyze: ${e.message?.slice(0, 80)}`);
  }

  // 2. Extraer normas citadas del análisis
  const normasCitadas: string[] = [];
  const patrones = [
    /(?:código|ley|dfl)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*)),?\s*(?:art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?))/gi,
    /art(?:\.|ículo)?\s*(\d+[°º]?[a-z]?)\s*(?:del|de la|de)\s*(?:código|ley)\s+(?:del\s+)?([a-zá-ú]+|(?:\d[\d.]*))/gi,
  ];
  for (const re of patrones) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(analisis)) !== null) {
      const cita = patrones.indexOf(re) === 0 ? `${m[1]} Art. ${m[2] || ""}` : `${m[2]} Art. ${m[1]}`;
      if (!normasCitadas.includes(cita)) normasCitadas.push(cita);
    }
  }

  // 3. Evaluar artículos
  const correctas: string[] = [], compatibles: string[] = [], incorrectas: string[] = [];
  for (const esperada of caso.normasEsperadas) {
    const e = normaNorm(esperada);
    let ok = false;
    for (const citada of normasCitadas) {
      const c = normaNorm(citada);
      if (c.includes(e) || e.includes(c)) { if (!correctas.includes(esperada)) correctas.push(esperada); ok = true; break; }
      if (normaCompat(e, c)) { if (!compatibles.includes(esperada)) compatibles.push(esperada); ok = true; break; }
    }
    if (!ok) { /* sin verificar, no error */ }
  }
  for (const citada of normasCitadas) {
    const c = normaNorm(citada);
    let ok = false;
    for (const esperada of caso.normasEsperadas) {
      const e = normaNorm(esperada);
      if (c.includes(e) || e.includes(c)) { ok = true; break; }
      if (normaCompat(e, c)) { ok = true; break; }
    }
    if (!ok && !incorrectas.includes(citada)) incorrectas.push(citada);
  }

  let evalArt = "sin_verificar";
  if (correctas.length === caso.normasEsperadas.length) evalArt = "correcta";
  else if (correctas.length + compatibles.length >= Math.ceil(caso.normasEsperadas.length * 0.5)) evalArt = "compatible";
  else if (incorrectas.length > 0) evalArt = "incorrecta";

  const tieneVerificar = analisis.includes("[VERIFICAR") || analisis.includes("[SIN COBERTURA");
  const areaCorrecta =
    caso.areaEsperada === "transito" ? (materiaObtenida === "transito" || materiaObtenida === "administrativo") :
    materiaObtenida === caso.areaEsperada;

  // 4. Clasificación
  let clasificacion: string;
  if (!analisis) clasificacion = "no_evaluable";
  else if (incorrectas.length > 0) clasificacion = "incorrecto";
  else if (areaCorrecta && evalArt === "correcta") clasificacion = "correcto";
  else if (areaCorrecta && (evalArt === "compatible" || evalArt === "sin_verificar")) clasificacion = "correcto_con_ajustes";
  else if (areaCorrecta) clasificacion = "parcial";
  else clasificacion = "incorrecto";

  // 5. Detectar señales equivocadas en materia secundaria y acciones
  const senalesEquivocadas: string[] = [];
  if (materiaSecundaria && caso.areaEsperada !== "transito" && materiaSecundaria.toLowerCase().includes("tránsito")) {
    senalesEquivocadas.push(`materiaSecundaria=tránsito (¡caso ${caso.areaEsperada}!)`);
  }
  if (acciones.some(a => /transito|tránsito/i.test(a)) && caso.areaEsperada !== "transito") {
    senalesEquivocadas.push(`acciones=tránsito (¡caso ${caso.areaEsperada}!)`);
  }
  if (acciones.some(a => /monitorio.*arrend/i.test(a)) && !/arrend|arriendo|monitorio/i.test(caso.relato)) {
    senalesEquivocadas.push(`acciones=monitorio arrendamiento (¡no es arrendamiento!)`);
  }

  return {
    id: caso.id,
    areaEsperada: caso.areaEsperada,
    areaObtenida: materiaObtenida,
    areaSecundariaObtenida: materiaSecundaria,
    areaCorrecta,
    clasificacion,
    evalArt,
    normasCitadas: normasCitadas.length,
    normasEsperadas: caso.normasEsperadas.length,
    correctas: correctas.length,
    compatibles: compatibles.length,
    incorrectas: incorrectas.length,
    senalesEquivocadas,
    tieneVerificar,
    analisisLargo: analisis.length,
    cached: false,
  };
}

async function main() {
  console.log(`=== AUDITORÍA CIEGA v2: ${casos.length} casos ===\n`);
  const resultados: any[] = [];
  const batch = 3;
  for (let i = 0; i < casos.length; i += batch) {
    const grupo = casos.slice(i, i + batch);
    const promesas = grupo.map(c => evaluar(c).catch(e => ({
      id: c.id, areaEsperada: c.areaEsperada, areaObtenida: null, areaSecundariaObtenida: null,
      areaCorrecta: false, clasificacion: "no_evaluable", evalArt: "sin_verificar",
      normasCitadas: 0, normasEsperadas: 0, correctas: 0, compatibles: 0, incorrectas: 0,
      senalesEquivocadas: [`error: ${e.message?.slice(0, 50)}`], tieneVerificar: false, analisisLargo: 0,
    })));
    const resultadosGrupo = await Promise.all(promesas);
    for (const r of resultadosGrupo) {
      resultados.push(r);
      const equivocadas = r.senalesEquivocadas.length > 0 ? ` ⚠️ SEÑALES EQUIVOCADAS: ${r.senalesEquivocadas.join(", ")}` : "";
      console.log(`[${r.id}] ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} ${r.areaObtenida || "?"}${r.areaSecundariaObtenida ? ` (+${r.areaSecundariaObtenida})` : ""} | normas: ${r.evalArt} (${r.correctas}c/${r.compatibles}comp/${r.incorrectas}inc) | verificar: ${r.tieneVerificar ? "✅" : "❌"}${equivocadas}`);
    }
  }

  const resumen: any = {};
  for (const r of resultados) resumen[r.clasificacion] = (resumen[r.clasificacion] || 0) + 1;
  resumen.total = resultados.length;
  resumen.areaCorrecta = resultados.filter((r: any) => r.areaCorrecta).length;
  resumen.areaIncorrecta = resultados.filter((r: any) => !r.areaCorrecta).length;
  resumen.conSenalesEquivocadas = resultados.filter((r: any) => r.senalesEquivocadas.length > 0).length;
  resumen.detalleSenalesEquivocadas = resultados.filter((r: any) => r.senalesEquivocadas.length > 0).map((r: any) => ({ id: r.id, areaEsperada: r.areaEsperada, senales: r.senalesEquivocadas }));
  resumen.conVerificar = resultados.filter((r: any) => r.tieneVerificar).length;
  resumen.normasCorrectas = resultados.filter((r: any) => r.evalArt === "correcta").length;
  resumen.normasCompatibles = resultados.filter((r: any) => r.evalArt === "compatible").length;
  resumen.normasIncorrectas = resultados.filter((r: any) => r.evalArt === "incorrecta").length;

  console.log("\n=== RESUMEN v2 ===");
  console.log(JSON.stringify(resumen, null, 2));

  fs.mkdirSync("evaluation/evaluacion-ciega-v2/resultados", { recursive: true });
  fs.writeFileSync("evaluation/evaluacion-ciega-v2/resultados/resultados.json", JSON.stringify(resultados, null, 2));
  fs.writeFileSync("evaluation/evaluacion-ciega-v2/resultados/resumen.json", JSON.stringify(resumen, null, 2));
  const csv = [
    "id,areaEsperada,areaObtenida,areaSecundariaObtenida,areaCorrecta,clasificacion,evalArt,normasCitadas,normasEsperadas,correctas,compatibles,incorrectas,senalesEquivocadas,tieneVerificar,analisisLargo",
    ...resultados.map((r: any) => [r.id, r.areaEsperada, r.areaObtenida, r.areaSecundariaObtenida, r.areaCorrecta, r.clasificacion, r.evalArt, r.normasCitadas, r.normasEsperadas, r.correctas, r.compatibles, r.incorrectas, `"${r.senalesEquivocadas.join("; ")}"`, r.tieneVerificar, r.analisisLargo].join(","))
  ].join("\n");
  fs.writeFileSync("evaluation/evaluacion-ciega-v2/resultados/resultados.csv", csv);

  const reporte = `# Auditoría Ciega v2 — LegalHelp

## Resumen
- Total casos: ${resumen.total}
- Correcto: ${resumen.correcto || 0}
- Correcto con ajustes: ${resumen.correcto_con_ajustes || 0}
- Parcial: ${resumen.parcial || 0}
- Incorrecto: ${resumen.incorrecto || 0}
- No evaluable: ${resumen.no_evaluable || 0}

## Materia
- Correcta: ${resumen.areaCorrecta}/${resumen.total}
- Incorrecta: ${resumen.areaIncorrecta}/${resumen.total}
- Con señales equivocadas (materia secundaria o acciones): ${resumen.conSenalesEquivocadas}/${resumen.total}

## Normas
- Correctas: ${resumen.normasCorrectas || 0}
- Compatibles: ${resumen.normasCompatibles || 0}
- Incorrectas: ${resumen.normasIncorrectas || 0}

## Detalle de señales equivocadas
${resumen.detalleSenalesEquivocadas?.map((s: any) => `- **${s.id}** [${s.areaEsperada}]: ${s.senales.join(", ")}`).join("\n") || "Ninguna"}

## Detalle por caso
${resultados.map((r: any) => `- **${r.id}** [${r.areaEsperada}]: ${r.clasificacion} | area: ${r.areaCorrecta ? "✅" : "❌"} ${r.areaObtenida || "?"}${r.areaSecundariaObtenida ? ` (+${r.areaSecundariaObtenida})` : ""} | normas: ${r.evalArt} | equivocadas: ${r.senalesEquivocadas.length > 0 ? r.senalesEquivocadas.join(", ") : "sin"}`).join("\n")}
`;
  fs.writeFileSync("evaluation/evaluacion-ciega-v2/resultados/reporte_piloto.md", reporte);
  console.log("\nGuardados en evaluation/evaluacion-ciega-v2/resultados/");
}
main();
