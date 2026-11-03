// Capa ⑤⑥ del pipeline: hechos tipificados (slots) + reglas de subsunción
// para normas top. Determinista: no LLM. Salida para inyectar al prompt.

export type SlotTri = "si" | "no" | "no_consta";

export interface HechosTipificados {
  despidoMencionado: boolean;
  cotizacionesMora: SlotTri;
  pagoCotizacionesAntesTermino: SlotTri;
  fechaTermino: string | null;
  feriadoOHeMencionado: boolean;
  cartaDespidoMencionada: boolean;
  tutelaMencionada: boolean;
  arrendamientoMencionado: boolean;
  alimentosMencionados: boolean;
}

export interface HipotesisSubsuncion {
  normaKey: string;
  etiqueta: string;
  hipotesis: string;
  confianza: "alta" | "media" | "baja";
  slotsUsados: string[];
}

const RE = {
  despido: /\bdespid(?:o|a|os|as|ir|ieron)?\b|\bt[eé]rmino\s+(?:del?\s+)?contrato\b|\bnecesidades?\s+de\s+la\s+empresa\b/i,
  cotMora: /\bcotizaciones?\s+(?:impagas?|adeudadas?|atrasadas?|morosas?)\b|\bmora\s+previsional\b|\bsin\s+cotizaciones?\b/i,
  cotAlDia: /\bcotizaciones?\s+(?:al\s+d[ií]a|pagadas?|enteradas?|al\s+corriente)\b/i,
  pagoAntes: /\b(?:pag(?:o|aron|ado)|enterad[oa]s?)\s+(?:las\s+)?cotizaciones?.{0,40}(?:antes|previo).{0,30}(?:despido|t[eé]rmino)\b/i,
  fechaTerm: /\b(?:con\s+fecha|el\s+d[ií]a|con\s+fecha)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+de\s+\w+\s+de\s+\d{4})\b/i,
  feriadoHe: /\bferiado\b|\bvacaciones\b|\bhoras?\s+extraordinarias?\b|\bhoras?\s+extras?\b/i,
  carta: /\bcarta\s+de\s+despido\b|\bcomunicaci[oó]n\s+del?\s+despido\b/i,
  tutela: /\btutela\s+(?:laboral|de\s+derechos?\s+fundamentales?)\b/i,
  arriendo: /\barrendamiento\b|\barriendo\b|\barrendatari[oa]\b|\bdesahucio\b/i,
  alimentos: /\balimentos?\b|\bpensi[oó]n\s+alimenticia\b|\bLey\s*n?[°º.\s]*14\.?\s?908\b/i,
};

function tri(si: boolean, no: boolean): SlotTri {
  if (si && !no) return "si";
  if (no && !si) return "no";
  if (si && no) return "no_consta";
  return "no_consta";
}

export function extraerHechosTipificados(texto: string): HechosTipificados {
  const t = texto || "";
  return {
    despidoMencionado: RE.despido.test(t),
    cotizacionesMora: tri(RE.cotMora.test(t), RE.cotAlDia.test(t) && !RE.cotMora.test(t)),
    pagoCotizacionesAntesTermino: tri(RE.pagoAntes.test(t), RE.cotMora.test(t)),
    fechaTermino: (() => {
      const m = t.match(RE.fechaTerm);
      return m ? m[1] : null;
    })(),
    feriadoOHeMencionado: RE.feriadoHe.test(t),
    cartaDespidoMencionada: RE.carta.test(t),
    tutelaMencionada: RE.tutela.test(t),
    arrendamientoMencionado: RE.arriendo.test(t),
    alimentosMencionados: RE.alimentos.test(t),
  };
}

/** Reglas de inciso / hipótesis para el núcleo laboral-civil más frecuente. */
export function aplicarSubsuncion(h: HechosTipificados): HipotesisSubsuncion[] {
  const out: HipotesisSubsuncion[] = [];

  if (h.despidoMencionado && h.cotizacionesMora === "si") {
    out.push({
      normaKey: "CT-162 / L19631",
      etiqueta: "Ley Bustos / art. 162 CT — cotizaciones al despido",
      hipotesis:
        "Hipótesis: despido con eventual ineficacia o efectos del art. 162 CT si no se acredita pago de cotizaciones previsionales al momento del término (Ley 19.631). NO asumir convalidación por promesa de pago futuro.",
      confianza: h.pagoCotizacionesAntesTermino === "no" ? "alta" : "media",
      slotsUsados: ["despidoMencionado", "cotizacionesMora", "pagoCotizacionesAntesTermino"],
    });
  }

  if (h.despidoMencionado && h.feriadoOHeMencionado) {
    out.push({
      normaKey: "CT-feriado-HE",
      etiqueta: "Feriado / horas extraordinarias en contexto de despido",
      hipotesis:
        "Hipótesis: rubros de feriado y/o horas extraordinarias deben ser acreditados por quien los cobra. En contestación: negar saldo si no consta liquidación fehaciente; evitar allanamiento condicional ('si existiere').",
      confianza: "media",
      slotsUsados: ["despidoMencionado", "feriadoOHeMencionado"],
    });
  }

  if (h.tutelaMencionada) {
    out.push({
      normaKey: "CT-tutela",
      etiqueta: "Tutela de derechos fundamentales (procedimiento especial)",
      hipotesis:
        "Hipótesis: procedimiento de tutela laboral. Verificar plazo de interposición y derechos fundamentales invocados; no tratar como despido ordinario sin más.",
      confianza: "media",
      slotsUsados: ["tutelaMencionada"],
    });
  }

  if (h.arrendamientoMencionado) {
    out.push({
      normaKey: "L18101",
      etiqueta: "Arrendamiento de predios urbanos (Ley 18.101)",
      hipotesis:
        "Hipótesis: litigio de arrendamiento urbano. Anclar plazos y causales a Ley 18.101 + CC; no importar reglas laborales.",
      confianza: "media",
      slotsUsados: ["arrendamientoMencionado"],
    });
  }

  if (h.alimentosMencionados) {
    out.push({
      normaKey: "L14908",
      etiqueta: "Pensiones alimenticias (Ley 14.908)",
      hipotesis:
        "Hipótesis: materia de alimentos. Priorizar Ley 14.908 y tribunales de familia; no mezclar con cobro civil ordinario sin más.",
      confianza: "media",
      slotsUsados: ["alimentosMencionados"],
    });
  }

  return out;
}

/** Bloque compacto para system/user prompt del draft o premium. */
export function bloquePromptSubsuncion(hips: HipotesisSubsuncion[], hechos: HechosTipificados): string {
  if (!hips.length) return "";
  const lines = hips.map(
    (h, i) =>
      `${i + 1}. [${h.confianza}] ${h.etiqueta} (${h.normaKey})\n   ${h.hipotesis}`,
  );
  return (
    `\n[SUBSUNCIÓN DETERMINISTA — hipótesis de normas top; no son fallos judiciales]\n` +
    `Slots: despido=${hechos.despidoMencionado} cotMora=${hechos.cotizacionesMora} pagoCotAntesTermino=${hechos.pagoCotizacionesAntesTermino} feriado/HE=${hechos.feriadoOHeMencionado}\n` +
    lines.join("\n") +
    `\nUsa estas hipótesis como marco; no inventes requisitos de inciso que no consten en BCN/documento.\n`
  );
}
