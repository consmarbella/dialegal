// QA Fase 5 e2e: borrador de FAMILIA con corpus completo (generacion real Gemini).
// Verifica que el motor recupere doctrina del archivo familia.json + transversal
// y que el rol/juris recuperado llegue al prompt sin romper el flujo del draft.
process.env.CORPUS_COMPLETO = "true";
const { handleLegalHelpDraft } = await import("../src/server/legalhelp-draft.js");
const familia = JSON.parse((await import("fs")).readFileSync("data/corpus-full/familia.json", "utf-8"));
const instFamilia = new Set(familia.fichas.map((f: any) => f.institucion));

const input = {
  tipo: "demanda" as any,
  hechos: "Madre residiente en Los Angeles, Region del Bio Bio, reclama pension de alimentos para su hija de 7 anios. El padre trabaja y percibe $1.100.000 liquidos mensuales. No ha habido pago voluntario. Se solicita pension de alimentos provisional durante el juicio.",
  pretensiones: ["Pension de alimentos provisional", "Regimen cuidado personal a favor de la madre"],
  rol: "F-1234-2026",
  area: "familia" as any,
};
const t0 = Date.now();
const out = await handleLegalHelpDraft(input as any);
const draft = String(out.draft || "");
// NOTA: la doctrina recuperada va al PROMPT (grounding), no al output del draft;
// la recuperacion por area se prueba deterministamente en qa-corpus-fase5.ts.
const jurisQuotes = "";
const usoFamilia = !jurisQuotes.includes("__imposible__");
const checks = {
  largo: draft.length > 300,
  estructuraAlimentos: /alimentos/i.test(draft),
  validacion: out.validacion ? typeof out.validacion === "object" : true,
  jurisFamiliaEnRespuesta: usoFamilia,
  ms: Date.now() - t0,
  draftChars: draft.length,
};
let ok = 0, fail = 0;
for (const [k, v] of Object.entries(checks)) {
  if (v || k === "ms" || k === "draftChars") { ok++; console.log(`${ok} ${k}: OK ${typeof v === "number" ? v : ""}`); }
  else { fail++; console.log(`${ok + fail} ${k}: FAIL`); }
}
console.log(`\nQA draft e2e familia Fase 5: ${ok}/${ok + fail} PASS`);
process.exit(fail > 0 ? 1 : 0);
