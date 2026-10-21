// Detector automático de área legal para LegalHelp IA
// Basado en keywords del relato + pretensiones + extractorChile

export type DraftArea = "laboral" | "civil" | "familia" | "penal" | "administrativo" | "constitucional";

const KEYWORDS_POR_AREA: Record<DraftArea, string[]> = {
  laboral: [
    "despido", "cotizaciones", "feriado", "horas extra", "acoso", "Ley Karin", "hostigamiento",
    "tutela laboral", "indemnización", "años de servicio", "fuero", "maternal", "paternal",
    "contrata", "mandante", "subcontrata", "prácticas antisindicales", "sindicato",
    "negociación colectiva", "huelga", "descanso", "colación", "movilización",
    "seguro de cesantía", "AFC", "DT", "Dirección del Trabajo", "Juzgado del Trabajo",
    "S.J.L.", "RIT laboral", "carta de despido", "necesidades de la empresa",
    "art. 161", "art. 162", "art. 159", "art. 174", "art. 485", "art. 489",
    "daño moral laboral", "Ley 21.643", "Ley 19.728", "Ley 20.806",
  ],
  civil: [
    "daños", "perjuicios", "contrato", "incumplimiento", "resolución", "rescisión",
    "responsabilidad civil", "culpa", "dolo", "enriquecimiento sin causa",
    "pago", "cobro", "ejecutivo", "título ejecutivo", "letra de cambio", "pagaré",
    "cheque", "fianza", "aval", "prenda", "hipoteca", "arrendamiento", "arriendo",
    "desahucio", "usucapión", "prescripción", "caducidad", "nulidad", "anulación",
    "simulación", "vicios del consentimiento", "error", "violencia", "intimidación",
    "art. 1445", "art. 1545", "art. 1547", "art. 1554", "art. 2314", "art. 2320",
    "Código Civil", "CPC", "juicio ordinario", "juicio sumario", "juicio ejecutivo",
  ],
  familia: [
    "alimentos", "cuota alimentaria", "pensión de alimentos", "cuidado personal",
    "régimen de visitas", "tuición", "divorcio", "cese de convivencia",
    "compensación económica", "bienes gananciales", "sociedad conyugal",
    "separación de bienes", "filación", "reconocimiento", "impugnación",
    "adopción", "tutela", "curatela", "protección de derechos",
    "Juzgado de Familia", "S.J.F.", "Ley 19.968", "Ley 14.908",
    "art. 229", "art. 230", "art. 232", "art. 233", "art. 439", "art. 440",
  ],
  penal: [
    "querella", "denuncia", "delito", "imputado", "víctima", "querellante",
    "prisión preventiva", "sobreseimiento", "absolución", "condena",
    "pena", "sustitutiva", "libertad vigilada", "remisión condicional",
    "formalización", "investigación", "fiscalía", "defensor", "abogado querellante",
    "medidas cautelares", "arraigo", "firma", "prohibición de salida",
    "Corte de Apelaciones", "Tribunal de Juicio Oral", "garantías",
    "art. 1", "art. 2", "art. 12", "art. 13", "art. 14", "art. 15", "CPP",
    "Ley 19.696", "Ley 20.000", "Ley 20.084",
  ],
  administrativo: [
    "recurso de protección", "ilegalidad", "acto administrativo", "municipalidad",
    "servicio público", "decreto", "resolución exenta", "ordenanza",
    "contraloría", "tribunal ambiental", "evaluación de impacto ambiental",
    "concesión", "permiso", "licencia", "patente", "régimen de contratación",
    "funcionario público", "estatuto administrativo", "sumario", "sanción",
    "Ley 19.880", "Ley 20.285", "Corte Suprema", "auto acordado",
    "art. 5", "art. 6", "art. 7", "art. 8", "art. 9", "art. 10",
  ],
  constitucional: [
    "derechos fundamentales", "garantías", "inconstitucionalidad", "TC",
    "Tribunal Constitucional", "requerimiento", "reclamo", "autos acordados",
    "igualdad", "no discriminación", "debido proceso", "libertad", "propiedad",
    "habeas corpus", "amparo", "protección", "control de constitucionalidad",
    "Ley 17.997", "Ley 18.575", "CPR", "Constitución Política",
    "art. 1", "art. 2", "art. 3", "art. 4", "art. 5", "art. 19", "art. 20", "art. 21",
  ],
};

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function detectarArea(hechos: string, pretensiones: string[], extractorAcciones?: string[]): DraftArea {
  const textoCompleto = normalizeText([hechos, ...pretensiones, ...(extractorAcciones || [])].join(" "));
  
  const scores: Record<DraftArea, number> = {
    laboral: 0,
    civil: 0,
    familia: 0,
    penal: 0,
    administrativo: 0,
    constitucional: 0,
  };

  for (const [area, keywords] of Object.entries(KEYWORDS_POR_AREA)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${normalizeText(kw)}\\b`, "g");
      const matches = textoCompleto.match(regex);
      if (matches) scores[area as DraftArea] += matches.length;
    }
  }

  // Bonus por acciones del extractor
  if (extractorAcciones) {
    for (const accion of extractorAcciones) {
      const accionNorm = normalizeText(accion);
      if (accionNorm.includes("despido") || accionNorm.includes("nulidad") || 
          accionNorm.includes("tutela") || accionNorm.includes("karin") ||
          accionNorm.includes("cotizacion")) scores.laboral += 3;
      if (accionNorm.includes("alimentos") || accionNorm.includes("cuidado") ||
          accionNorm.includes("divorcio") || accionNorm.includes("visitas")) scores.familia += 3;
    }
  }

  // Área con mayor score
  let maxArea: DraftArea = "laboral"; // default (mayor volumen)
  let maxScore = -1;
  for (const [area, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxArea = area as DraftArea;
    }
  }

  // Si empatan o score 0, default laboral
  if (maxScore <= 1) return "laboral";
  return maxArea;
}

export function getAreaConfidence(hechos: string, pretensiones: string[]): { area: DraftArea; confidence: number } {
  const area = detectarArea(hechos, pretensiones);
  const textoCompleto = normalizeText([hechos, ...pretensiones].join(" "));
  const keywords = KEYWORDS_POR_AREA[area];
  let hits = 0;
  for (const kw of keywords) {
    if (new RegExp(`\\b${normalizeText(kw)}\\b`, "g").test(textoCompleto)) hits++;
  }
  const confidence = Math.min(1, hits / Math.max(1, keywords.length * 0.3));
  return { area, confidence };
}