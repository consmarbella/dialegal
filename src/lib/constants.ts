export interface CaseData {
  ready?: boolean;
  tipo_documento?: string;
  nombre?: string;
  rut?: string;
  email?: string;
  tribunal?: string;
  rol?: string;
  materia?: string;
  demandante?: string;
  demandado?: string;
  story?: string;
  area?: string;
  [key: string]: unknown;
}

export interface DocType {
  id: string;
  label: string;
  description: string;
  area: string;
  price: string;
  priceCLP: number;
  template: string;
}

export const DOC_TYPES: DocType[] = [
  {
    id: 'contestacion-demanda-civil',
    label: 'Contestación de Demanda Civil',
    description: 'Escrito de contestación con excepciones dilatorias y perentorias para juicio ordinario civil.',
    area: 'civil',
    price: '$10.000',
    priceCLP: 10000,
    template: 'contestacion_civil',
  },
  {
    id: 'oposicion-ejecutivo',
    label: 'Oposición a Juicio Ejecutivo',
    description: 'Escrito de oposición de excepciones a la ejecución (Art. 464 CPC) para juicio de cobranza.',
    area: 'civil',
    price: '$10.000',
    priceCLP: 10000,
    template: 'oposicion_ejecutivo',
  },
  {
    id: 'demanda-despido',
    label: 'Demanda por Despido Injustificado',
    description: 'Demanda laboral por despido injustificado, indebido o nulo con solicitud de indemnizaciones.',
    area: 'laboral',
    price: '$10.000',
    priceCLP: 10000,
    template: 'demanda_despido',
  },
  {
    id: 'demanda-alimentos',
    label: 'Demanda de Alimentos',
    description: 'Demanda de pensión de alimentos para hijos menores con solicitud de alimentos provisorios.',
    area: 'familia',
    price: '$10.000',
    priceCLP: 10000,
    template: 'demanda_alimentos',
  },
  {
    id: 'querella-penal',
    label: 'Querella Penal',
    description: 'Querella criminal para ejercer acción penal por delitos contra la propiedad o las personas.',
    area: 'penal',
    price: '$10.000',
    priceCLP: 10000,
    template: 'querella_penal',
  },
  {
    id: 'recurso-apelacion',
    label: 'Recurso de Apelación',
    description: 'Recurso de apelación contra sentencia definitiva o interlocutoria ante Corte de Apelaciones.',
    area: 'civil',
    price: '$10.000',
    priceCLP: 10000,
    template: 'recurso_apelacion',
  },
];

export const MONTHLY_PRICE_CLP = 14990;

export function getDocPriceCLP(docId?: string): number {
  if (!docId) return 10000;
  const doc = DOC_TYPES.find((d) => d.id === docId);
  return doc?.priceCLP ?? 10000;
}

export const LEGAL_AREAS = [
  { id: 'civil', label: 'Civil', icon: '⚖️', desc: 'Cobranzas, contratos, arriendos, herencias' },
  { id: 'laboral', label: 'Laboral', icon: '🏭', desc: 'Despidos, indemnizaciones, tutela laboral' },
  { id: 'familia', label: 'Familia', icon: '👨‍👩‍👧', desc: 'Alimentos, cuidado personal, divorcio' },
  { id: 'penal', label: 'Penal', icon: '🚔', desc: 'Querellas, defensa penal, citaciones fiscalía' },
  { id: 'policia_local', label: 'Policía Local', icon: '📋', desc: 'Multas, infracciones municipales, apelaciones' },
  { id: 'administrativo', label: 'Administrativo', icon: '🏛️', desc: 'Recursos de protección, sanciones, derechos' },
  { id: 'otro', label: 'Otra Materia', icon: '📌', desc: 'Consultas generales y orientación legal' },
] as const;

export const SEO_ROUTES = [
  {
    path: '/diagnostico-demanda-civil',
    title: 'Diagnóstico de Demanda Civil | LegalHelp Chile',
    description: 'Analiza tu demanda civil con IA. Identifica plazos fatales, riesgos de embargo y pasos legales a seguir según el CPC chileno.',
    area: 'civil',
    keywords: 'demanda civil chile, contestación demanda, juicio civil, CPC, embargo judicial',
  },
  {
    path: '/diagnostico-despido-injustificado',
    title: 'Diagnóstico de Despido Injustificado | LegalHelp Chile',
    description: 'Evalúa si tu despido fue injustificado. Cálculo de indemnizaciones, plazos para demandar y tutela laboral según el Código del Trabajo.',
    area: 'laboral',
    keywords: 'despido injustificado chile, demanda laboral, código del trabajo, indemnización por años de servicio',
  },
  {
    path: '/diagnostico-ley-de-alimentos',
    title: 'Diagnóstico de Demanda de Alimentos | LegalHelp Chile',
    description: 'Analiza tu caso de pensión de alimentos. Conoce los alimentos provisorios, medidas de apremio y cómo defenderte en el Juzgado de Familia.',
    area: 'familia',
    keywords: 'demanda alimentos chile, pensión alimenticia, ley 19.968, alimentos provisorios, juzgado de familia',
  },
  {
    path: '/diagnostico-causa-penal',
    title: 'Diagnóstico de Causa Penal | LegalHelp Chile',
    description: 'Recibiste una citación de fiscalía o querella penal. Conoce tus derechos, plazos procesales y cómo preparar tu defensa.',
    area: 'penal',
    keywords: 'causa penal chile, citación fiscalía, defensoría penal pública, código procesal penal',
  },
  {
    path: '/embargo-juicio-ejecutivo',
    title: 'Defensa contra Embargo y Juicio Ejecutivo | LegalHelp Chile',
    description: 'Te notificaron un mandamiento de ejecución y embargo. Descubre cómo oponer excepciones en 8 días hábiles y detener el remate de tus bienes.',
    area: 'civil',
    keywords: 'embargo judicial chile, juicio ejecutivo, mandamiento de ejecución, oposición de excepciones, artículo 464 CPC',
  },
  {
    path: '/plazos-fatales-chile',
    title: 'Calculadora de Plazos Fatales Chile | LegalHelp Chile',
    description: 'Calcula plazos procesales en días hábiles CPC y laborales. Identifica fechas límite para contestar demandas, apelar y presentar recursos.',
    area: 'civil',
    keywords: 'plazos fatales chile, días hábiles CPC, calculadora plazos judiciales, artículo 66 CPC',
  },
  {
    path: '/como-usar-ojv',
    title: 'Cómo Usar la Oficina Judicial Virtual (OJV) | LegalHelp Chile',
    description: 'Guía paso a paso para consultar causas en la OJV con ClaveÚnica. Revisa resoluciones, descarga expedientes y haz seguimiento de tu caso.',
    area: 'civil',
    keywords: 'oficina judicial virtual chile, OJV, clave única, consulta de causas PJUD, poder judicial chile',
  },
  {
    path: '/glosario-juridico-chileno',
    title: 'Glosario Jurídico Chileno | Traduce el Leguleyo | LegalHelp',
    description: 'Diccionario de términos legales chilenos. Aprende qué significa traslado, rebeldía, mandamiento de ejecución, apercibimiento y más.',
    area: 'civil',
    keywords: 'glosario jurídico chileno, diccionario legal, traductor de leguleyo, términos PJUD',
  },
];
