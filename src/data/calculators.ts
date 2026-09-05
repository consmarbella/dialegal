export interface CalculatorPage {
  slug: string;
  titleSEO: string;
  metaDescription: string;
  h1: string;
  description: string;
}

export const CALCULATOR_PAGES: CalculatorPage[] = [
  {
    slug: "/calculadora-prescripcion-multas",
    titleSEO: "Calculadora Prescripción Multas TAG Chile 2026 | ¿Ya Prescribió Tu Multa?",
    metaDescription: "Calcula si tu multa TAG ya prescribió. Ingresa la fecha de anotación y te decimos si puedes eliminarla legalmente. Herramienta gratis actualizada 2026.",
    h1: "Calculadora de Prescripción de Multas TAG",
    description: "Verifica si tu multa de tránsito o TAG ya prescribió según la ley chilena vigente."
  },
  {
    slug: "/calculadora-condonacion-multas",
    titleSEO: "Calculadora Condonación 80% Multas TAG Chile 2026 | ¿Cuánto Pagas?",
    metaDescription: "Calcula cuánto pagas con el 80% de descuento por condonación de multas TAG. Ingresa el monto y descubre tu precio final. Herramienta gratis.",
    h1: "Calculadora de Condonación 80% Multas TAG",
    description: "Calcula el monto final con el descuento del 80% por condonación de multas de tránsito."
  }
];

export function getCalculatorPage(slug: string): CalculatorPage | undefined {
  return CALCULATOR_PAGES.find(p => p.slug === slug);
}
