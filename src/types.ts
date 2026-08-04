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
}
