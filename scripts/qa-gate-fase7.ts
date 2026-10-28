// QA Fase 7: GATE premium (B+C híbrido) — hallazgosBloqueantes.
// Verifica: (a) XX crudo bloquea; (b) RIT del encabezado que no está en el
// documento bloquea; (c) RIT heredado PERO presente en el documento NO bloquea
// (patrón legítimo: el dictamen reproduce el RIT del expediente adjunto);
// (d) hallazgos probabilísticos (rol/monto/art.) NUNCA bloquean.
let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "").slice(0, 200)}`); }
}
const VI = await import("../validadorInforme.js");

const insumosBase = {
  rolesCorpus: ["41150-2021"] as string[],
  artsCubiertos: ["157", "161"] as string[],
  artsPendientes: [] as string[],
  montosDoc: ["350.000"] as string[],
  textoDoc: "RIT C-5500-2024, Juzgado de Letras y Garantía de Rancagua. El trabajador percibía $350.000.",
};

// a. encabezado con RIT desconocido -> bloquea
const r1 = "S.J.L. Rancagua\nRIT C-9999-2026\nEN LO PRINCIPAL: demanda. Rol N° 41150-2021 (en corpus).";
const b1 = VI.hallazgosBloqueantes(VI.validarInforme(r1, insumosBase), r1, insumosBase.textoDoc);
chk("a bloquea RIT encabezado sin fuente", b1.some((h) => h.startsWith("encabezado_rit_ruc")), b1);

// b. encabezado con GLOSA XX -> bloquea
const r2 = "S.J.L. [DATA]\nRIT C-5500-2024\nPetitorio: indemnizacion de $350.000 para el señor XX (titular)";

// (la consulta es el texto del report; el textoDoc tiene el RIT correcto)
const b2 = VI.hallazgosBloqueantes(VI.validarInforme("RIT C-5500-2024\nEl señor XX comparece", insumosBase), "RIT C-5500-2024\nEl señor XX comparece", insumosBase.textoDoc);
chk("b bloquea marcador XX crudo", b2.some((h) => h.includes("hueco_XX")), b2);

// c. RIT del encabezado PRESENTE en el documento -> NO bloquea
const r3 = "S.J.L. Rancagua\nRIT C-5500-2024\nPetitorio de indemnización conforme a lo probado.";
const b3 = VI.hallazgosBloqueantes(VI.validarInforme(r3, insumosBase), r3, insumosBase.textoDoc);
chk("c RIT legítimo no bloquea", b3.length === 0, b3);

// d. rol no en corpus y monto no corroborado -> solo ANOTACIÓN, no gate
const r4 = "Argumento con Rol N° 20.000-2019 (no está en corpus) y monto $999.999.";
const v4 = VI.validarInforme(r4, insumosBase);
const b4 = VI.hallazgosBloqueantes(v4, r4, insumosBase.textoDoc);
chk("d rol fuera de corpus NO bloquea (es anotación)", b4.length === 0 && v4.rolesNoEnCorpus.length === 1, { b4, rolesNo: v4.rolesNoEnCorpus });

// e. notas: la nota blindaje incluye el rol NO VERIFICADO
const nota = VI.notaBlindajeReporte(v4);
chk("e nota blindaje alude al rol no verificado", nota.includes("20000-2019") && nota.includes("NO VERIFICADO"), nota.slice(0, 80));

console.log(fail === 0 ? `\nQA gate Fase 7: ${ok}/${ok + fail} PASS` : `\nQA gate Fase 7: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
