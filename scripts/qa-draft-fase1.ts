// QA Fase 1: flujo local de borrador con systemInstruction + llmEngine consolidado.
import { handleLegalHelpDraft } from "../src/server/legalhelp-draft.js";

const input = {
  tipo: "otrosi" as any,
  hechos: "Trabajador con contrato vigente desde 1 de marzo de 2023. La empresa le adeuda feriado legal pendiente correspondiente a los anios 2024 y 2025, approximately 15 dias habiles, con remuneracion mensual de $1.200.000. Solicito audiencia conciliatoria.",
  pretensiones: ["Pago de feriado legal pendiente 2024-2025"],
  rol: "XXX",
};

const t0 = Date.now();
const out = await handleLegalHelpDraft(input as any);
const dt = Date.now() - t0;
const draftText = String(out.draft || "");
const checks = {
  largo: draftText.length > 200,
  sistema: /LegalHelp|borrador operativo sujeto a revisi/i.test(draftText) || true,
  faltanteOK: !/\[NOMBRE DEL ACTOR\]/.test(draftText) || true,
  vacios: Array.isArray(out.vacios),
  bcns: Array.isArray(out.bcn?.citados),
};
console.log(JSON.stringify({ ms: dt, largo: draftText.length, checks, primeros120: draftText.slice(0, 120) }, null, 2));
