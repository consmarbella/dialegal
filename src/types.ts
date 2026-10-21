export type LegalArea = 
  | 'civil' 
  | 'laboral' 
  | 'familia' 
  | 'penal' 
  | 'policia_local' 
  | 'administrativo' 
  | 'otro';

export interface CaseSample {
  id: string;
  title: string;
  area: LegalArea;
  badge: string;
  description: string;
  userStory: string;
  documentText: string;
  notificationDate?: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  area: string;
  definition: string;
  practicalImpact: string;
  codeReference?: string;
  exampleInPjud?: string;
}

export interface ProceduralPreset {
  id: string;
  name: string;
  area: LegalArea;
  days: number;
  type: 'habiles_cpc' | 'habiles_laboral' | 'corridos';
  article: string;
  code: string;
  description: string;
  consequenceIfMissed: string;
  daysTypeLabel?: string;
}

export interface SavedAnalysis {
  id: string;
  date: string;
  title: string;
  area: LegalArea;
  userStory: string;
  analysisMarkdown: string;
  notificationDate?: string;
  isPaid?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  isQuotaExhausted?: boolean;
  whatsappUrl?: string;
}

export interface PremiumSource {
  title: string;
  uri: string;
  domain: string;
}

export interface BcnArticuloCitado {
  nombreNorma: string;
  articulo: string;
  vigente: boolean;
  fechaVersion: string;
  url: string;
}

export interface JurisRecomendacion {
  institucion: string;
  materia: string;
  autor: string;
  obra: string;
  rolFalloRector: string;
  fechaFalloRector: string;
  normas: string[];
}

export interface CasoJurisRecomendacion {
  tipo: string;
  tribunal: string;
  sala: string;
  rol: string;
  fecha: string;
  materia: string;
  doctrina: string;
  normas: string;
  link: string;
}

export interface ValidacionInformeUI {
  rolesEnCorpus: string[];
  rolesNoEnCorpus: string[];
  artsCubiertos: string[];
  artsSinCobertura: string[];
  montosInforme: number;
  montosNoCorroborados: string[];
}

export interface DocumentoExtraidoUI {
  acciones: string[];
  juzgado: string;
  articulosInvocados: string[];
}

export interface PremiumResult {
  report: string;
  sources: PremiumSource[];
  materia: string;
  grounded: boolean;
  cached?: boolean;
  bcn?: {
    citados: BcnArticuloCitado[];
    pendientes: Array<{ nombreNorma: string; motivo: string }>;
  };
  jurisprudencia?: JurisRecomendacion[];
  casos?: CasoJurisRecomendacion[];
  validacion?: ValidacionInformeUI | null;
  documentos?: DocumentoExtraidoUI | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGALHELP IA — Motor de Redacción Procesal
// ──────────────────────────────────────────────────────────────────────────────

export type DraftTipo = 
  | "demanda" 
  | "contestacion" 
  | "otrosi" 
  | "minuta" 
  | "contrato" 
  | "correo";

export type DraftArea = "laboral" | "civil" | "familia" | "penal" | "administrativo" | "constitucional";

export interface DraftInput {
  tipo: DraftTipo;
  hechos: string;
  pretensiones: string[];
  documentos?: string[];
  area?: DraftArea;
  rol?: string;
  tribunal?: string;
  // Contexto heredado del análisis (Motor v2): dictamen técnico previo y documento real del expediente
  dictamen?: string;
  documentoCaso?: string;
  // Respuestas de la auditoría de vacíos (regeneración guiada)
  respuestasAuditoria?: string;
}

// Auditoría determinista de vacíos críticos (Fase 2)
export interface VacioCritico {
  campo: string;
  prioridad: 'fatal' | 'importante';
  pregunta: string;
  fragmento?: string;
}

export interface ValidacionLegalHelp extends ValidacionInformeUI {
  estructuraJudicial: boolean;
  articulosClaveFaltantes: string[];
  petitorioValido: boolean;
  numeracionHechosValida: boolean;
}

export interface DraftMetadatos {
  tipo: DraftTipo;
  area: DraftArea;
  articulosClave: string[];
  tokensEstimados: number;
}

export interface DraftOutput {
  draft: string;
  validacion: ValidacionLegalHelp;
  vacios?: VacioCritico[];
  bcn: {
    citados: BcnArticuloCitado[];
    pendientes: Array<{ nombreNorma: string; motivo: string }>;
  };
  metadatos: DraftMetadatos;
}
