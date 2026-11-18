import "dotenv/config";
process.env.NUCLEO_TIPADO = "true";

import { handleLegalHelpDraft } from "../src/server/legalhelp-draft.js";

const input = {
  tipo: "contestacion",
  area: "civil" as any,
  postura: "demandado" as const,
  hechos: `Me llegó una demanda de TECNOLOGÍA Y SERVICIOS SpA por cumplimiento de contrato e indemnización de perjuicios. Afirman que emitieron la Factura N° 4500 por $15.500.000 el 1 de marzo de 2025, vencida el 30 de marzo de 2025, y que no se pagó. En realidad el software que entregaron presentó graves fallas: se entregó el 20 de febrero de 2025, desde el inicio tuvo errores en el módulo de gestión de obras, reclamé por escrito el 5 de marzo de 2025 y la proveedora nunca respondió. Nunca recibí conforme. Piden además "intereses penales" sin fundamento e indemnización sin cuantificar.`,
  pretensiones: ["Rechazar la demanda", "Oponer ineptitud del libelo por intereses penales sin fundamento"],
  tribunal: "Juzgado Civil de Santiago",
  audience: "abogado" as const,
  enrutador: {
    materia: "civil",
    rol: "demandado",
    etapa: "defensa",
    alertas: { plazoFatal: true, medidasCautelares: false, requierePatrocinio: true, viciosFormales: true },
  },
};

const out = await handleLegalHelpDraft(input as any);
console.log("=== METADATOS ===");
console.log(JSON.stringify(out.metadatos, null, 2));
console.log("\n=== ALERTA ARRIBA (primeras 400 chars) ===");
console.log(out.draft.slice(0, 400));
console.log("\n=== INDICADORES DE CALIDAD ===");
const d = out.draft;
const dNorm = d.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const checks: Record<string, boolean> = {
  "S.J.L.": /S\.?J\.?L\.?/i.test(d),
  "Art. 303 / ineptitud": /303|ineptitud/i.test(d),
  "Art. 1552 / contrato no cumplido": /1552|contrato no cumplido/i.test(d),
  "hechos concretos (20 de febrero)": /20 de febrero/i.test(d),
  "Art. 3 Ley 19.983": /19\.?\s?983|merito ejecutivo/i.test(d),
  "Art. 1698 carga prueba": /1698/i.test(d),
  "Art. 262 conciliacion": /262|conciliacion/i.test(d),
  "reconvencion": /reconvencion/i.test(d),
  "petitorio numerado": /PIDO|PETITORIO/i.test(d),
  "costas": /costas/i.test(d),
  "otro si": /OTROSI|OTRO SI|OTROS[IÍ]/i.test(d),
  "ALERTA PROCESAL CRITICA": /ALERTA PROCESAL CRITICA/i.test(dNorm),
};
for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);
console.log("\n=== BCN ===");
console.log("Citados:", out.bcn.citados.map((c: any) => `${c.nombreNorma} art. ${c.articulo}`).join(" | "));
console.log("Pendientes:", out.bcn.pendientes.map((p: any) => p.nombreNorma).join(" | "));
console.log("\n=== CONTADOR [VERIFICAR] ===");
console.log("Apariciones de [VERIFICAR]:", (d.match(/\[VERIFICAR/g) || []).length);
console.log("Draft length:", d.length);
