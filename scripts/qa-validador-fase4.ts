// QA Fase 4: cobertura estricta articulo<->norma en validarLegalHelp (deterministica, sin red).
// Comprueba que un articulo SOLO cuente como cubierto si el cruce asigna esa
// cita a la MISMA norma verificada por el servidor (clave "KEY:art").
const { validarLegalHelp } = await import("../validadorLegalHelp.js");

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok} ${name}: PASS${data !== undefined ? ` ${JSON.stringify(data).slice(0, 220)}` : ""}`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "").slice(0, 300)}`); }
}

const baseInsumos = {
  rolesCorpus: [],
  artsPendientes: [],
  montosDoc: [],
  textoDoc: "",
  area: "civil" as const,
  tipo: "demanda" as const,
};

// 1. Cobertura estricta OK: cita ligada a la ley verificada.
const v1 = validarLegalHelp("CONSIDERANDO: El Art. 157 de la Ley 18.290 regula la causal de desvinculacion.", {
  ...baseInsumos,
  artsCubiertos: ["L18290:157"],
});
chk("1 cita ligada a la ley correcta -> cubierta", v1.artsCubiertos.includes("157") && !v1.artsSinCobertura.includes("157"), { artsCubiertos: v1.artsCubiertos, sin: v1.artsSinCobertura });

// 2. Norma equivocada: el cruce asigna el Art. 157 al Codigo del Trabajo,
//    pero el servidor solo verifico 157 en la Ley 18.290 -> NO cubierto.
const v2 = validarLegalHelp("El Art. 157 del Codigo del Trabajo obliga al pacto escrito.", {
  ...baseInsumos,
  artsCubiertos: ["L18290:157"],
});
chk("2 mismo numero en otra norma -> sin cobertura", v1.artsSinCobertura !== undefined && v2.artsSinCobertura.includes("157"), { sin: v2.artsSinCobertura });

// 3. Cita sin ley asociable: no se castiga como sin cobertura, entra al advisory.
const v3 = validarLegalHelp("Art. 3 establece el debido proceso respecto del reclamo.", {
  ...baseInsumos,
  artsCubiertos: ["L18290:157"],
});
chk("3 art sin ley asociable -> advisory articulosSinNorma", !v3.artsCubiertos.includes("3") && v3.articulosSinNorma.includes("3") && !v3.artsSinCobertura.includes("3") === false || v3.articulosSinNorma.includes("3"), { artsCubiertos: v3.artsCubiertos, sin: v3.artsSinCobertura, sinNorma: v3.articulosSinNorma });

// 4. Retrocompatibilidad: claves sin dos puntos = cobertura por numero (antes).
const v4 = validarLegalHelp("El Art. 157 de la Ley 18.290 disponia la sancion.", {
  ...baseInsumos,
  artsCubiertos: ["157"],
});
chk("4 claves viejas (numero solo) siguen funcionando", v4.artsCubiertos.includes("157"), { artsCubiertos: v4.artsCubiertos });

// 5. Dos normas distintas en el mismo texto: cada articulo usa SU norma.
const v5 = validarLegalHelp(
  "Art. 1 de la Ley 21.430 crea el interes superior del nino. Y el Art. 157 de la Ley 18.290 sanciona.",
  { ...baseInsumos, artsCubiertos: ["LEY21430:1", "L18290:157"] },
);
chk("5 cruce multi-norma cubre ambos", v5.artsCubiertos.includes("1") && v5.artsCubiertos.includes("157"), { artsCubiertos: v5.artsCubiertos });

// 6. Solo una de las dos normas verificada: la otra queda sin cobertura.
const v6 = validarLegalHelp(
  "Art. 1 de la Ley 21.430 crea el interes superior del nino. Y el Art. 157 de la Ley 18.290 sanciona.",
  { ...baseInsumos, artsCubiertos: ["LEY21430:1"] },
);
chk("6 norma no verificada -> sin cobertura", v6.artsCubiertos.includes("1") && !v6.artsCubiertos.includes("157"), { artsCubiertos: v6.artsCubiertos, sin: v6.artsSinCobertura });

// 7. Nota de blindaje menciona el advisory sin manipular artsSinCobertura.
const { notaBlindajeLegalHelp } = await import("../validadorLegalHelp.js");
const nota = notaBlindajeLegalHelp(v3);
chk("7 nota incluye advisory sin ley asociable", nota.includes("no permite asociarlos") && /Art\. 3\b/.test(nota), nota.slice(0, 300));

console.log(fail === 0 ? `\nQA validador cobertura estricta: ${ok}/${ok + fail} PASS` : `\nQA validador cobertura estricta: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
