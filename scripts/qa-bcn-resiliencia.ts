// QA Resiliencia BCN (2026-10-29): la ingesta leychile era de 1 solo intento,
// con catchs silenciosos y error cacheado 3 min: un blip dejaba el bloque BCN
// ciego sin señal. Esta bateria cubre el reintento rapido condicionado y un
// canario EN VIVO contra el canal oficial (si BCN cae, este QA debe fallar:
// es la alarma, no un falso verde).
import { conReintentosRapido, RETRY_UMBRAL_MS, verificarCitasBCN } from "../bcnLeyChile.js";

let ok = 0, total = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  total++;
  console.log(`${total} ${nombre}: ${cond ? "PASS" : "FAIL"}`, detalle !== undefined ? JSON.stringify(detalle).slice(0, 180) : "");
  if (cond) ok++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. falla rapida -> reintenta y recupera
let llamadas = 0;
const r1 = await conReintentosRapido(async () => {
  llamadas++;
  if (llamadas === 1) throw new Error("conn refused (simulado)");
  return "xml-ok";
});
check("1 blip rapido: retry recupera (2 llamadas)", r1 === "xml-ok" && llamadas === 2, { llamadas });

// 2. falla rapida x2 -> falla tras 2 llamadas (sin tercer intento)
llamadas = 0;
let r2 = "no-lanzo";
try {
  await conReintentosRapido(async () => { llamadas++; throw new Error("5xx (simulado)"); });
} catch (e: any) { r2 = String(e?.message || e); }
check("2 blip persistente: falla tras 2 llamadas", r2.includes("5xx") && llamadas === 2, { llamadas });

// 3. falla LENTA (>= umbral) -> NO reintenta (preserva latencia)
llamadas = 0;
let r3 = "no-lanzo";
try {
  await conReintentosRapido(async () => { llamadas++; await sleep(80); throw new Error("timeout (simulado)"); }, 40);
} catch (e: any) { r3 = String(e?.message || e); }
check("3 falla lenta: sin retry (1 llamada)", r3.includes("timeout") && llamadas === 1, { llamadas });

// 4. exito al primer intento -> 1 llamada
llamadas = 0;
const r4 = await conReintentosRapido(async () => { llamadas++; return "xml-directo"; });
check("4 exito directo: 1 llamada", r4 === "xml-directo" && llamadas === 1, { llamadas });

// 5. umbral por defecto razonable (para prod: 25s de timeout >> 5s de umbral)
check("5 umbral default 5000ms", RETRY_UMBRAL_MS === 5000, { RETRY_UMBRAL_MS });

// 6. CANARIO EN VIVO: canal oficial BCN responde con XML real (CT art. 161).
//    Si esto falla, la fuente base esta caida: el QA debe fallar.
const t0 = Date.now();
const v = await verificarCitasBCN(["El despido se fundó en el artículo 161 del Código del Trabajo."]);
const ct161 = v.verificados.find((a) => a.keyNorma === "CT" && a.articulo === "161");
check("6 canario vivo: CT art. 161 verificado con XML oficial", !!ct161 && ct161.vigente === true && ct161.texto.length > 100, {
  ms: Date.now() - t0, textoLen: ct161?.texto.length, fechaVersion: ct161?.fechaVersion,
});

// 7. Evidencia Fase 4: el art. 66 CPC vigente NO suspende en vacaciones de
//    febrero (Ley 20.774). El texto oficial debe hablar de "feriados" sin
//    mencionar vacaciones judiciales.
const v66 = await verificarCitasBCN(["Los plazos de días hábiles se computan conforme al artículo 66 del Código de Procedimiento Civil."]);
const cpc66 = v66.verificados.find((a) => a.articulo === "66");
check("7 art. 66 CPC vigente sin suspension de febrero", !!cpc66 && !/vacaciones/i.test(cpc66.texto) && /feriados/i.test(cpc66.texto), {
  texto: cpc66?.texto.slice(0, 120),
});

console.log(`\nQA resiliencia BCN: ${ok}/${total} PASS`);
process.exit(ok === total ? 0 : 1);
