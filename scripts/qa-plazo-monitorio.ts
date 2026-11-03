// QA del resolutor de plazo para contestación civil: el procedimiento monitorio
// de arrendamiento (Ley 18.101) debe resolver a 10 días CORRIDOS, no a los 18
// días hábiles del juicio ordinario. Caso real: el escrito dice "demanda monitoria".
import { resolverPlazoIdCivilContestacion } from "../src/server/legalhelp-draft.js";
import { calcularPlazo } from "../plazosChile.js";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok + fail} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}

chk("monitoria + arrendamiento -> civil_monitorio_arrendamiento",
  resolverPlazoIdCivilContestacion("Demanda monitoria de cobro de rentas de arrendamiento (Ley 18.101).") === "civil_monitorio_arrendamiento");
chk("monitorio + 21.461 -> civil_monitorio_arrendamiento",
  resolverPlazoIdCivilContestacion("Procedimiento monitorio, texto segun Ley 21.461.") === "civil_monitorio_arrendamiento");
chk("contestacion ordinaria sin monitorio -> civil_contestacion",
  resolverPlazoIdCivilContestacion("Contestacion de demanda ordinaria de cobro de pagare.") === "civil_contestacion");
chk("juicio ejecutivo -> civil_ejecutivo_oposicion",
  resolverPlazoIdCivilContestacion("Juicio ejecutivo, mandamiento de ejecucion y embargo.") === "civil_ejecutivo_oposicion");

// Caso real: notificado 20-oct-2026, 10 días corridos -> venció el 30-oct-2026.
const r = calcularPlazo({ plazoId: "civil_monitorio_arrendamiento", fechaNotificacion: "2026-10-20" });
chk("10 corridos desde 20-oct-2026 -> limite 2026-10-30", r.ok && r.fechaLimite === "2026-10-30", r);
chk("10 corridos desde 20-oct-2026 -> diasOtorgados 10", r.diasOtorgados === 10, r);

console.log(fail === 0 ? `\nQA plazo monitorio: ${ok}/${ok + fail} PASS` : `\nQA plazo monitorio: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
