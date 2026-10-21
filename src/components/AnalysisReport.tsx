import React, { useState } from 'react';
import { LegalArea, ChatMessage, PremiumResult, DraftInput, DraftOutput } from '../types';
import { Scale, Download, Copy, BookmarkPlus, Send, MessageSquare, AlertCircle, CheckCircle, ShieldAlert, FileText, Lock, ShieldCheck, CreditCard, Sparkles, CheckCircle2, Globe, ExternalLink, RotateCcw, X } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { PreviewAlertCard } from './PreviewAlertCard';
import { DraftModal } from './DraftModal';

// --- Extracción de riesgos severos para la vista previa gratuita (Card de Alerta) ---
const RISK_KEYWORD_SCORES: Array<[RegExp, number]> = [
  [/embarg/i, 10],
  [/remat/i, 9],
  [/nulidad/i, 9],
  [/arresto|prisi[óo]n|detenci[óo]n/i, 9],
  [/rebeld/i, 8],
  [/lanzamiento|desalojo|lanzami/i, 8],
  [/ejecuci[óo]n|t[íi]tulo ejecutivo|desp[áa]chese/i, 7],
  [/perenci[óo]n/i, 7],
  [/prescripci[óo]n/i, 6],
  [/p[ée]rdida de (derechos|acci[óo]n|t[ée]rmino)/i, 6],
  [/apercibimiento/i, 6],
  [/insolvencia|quiebra/i, 5],
  [/costas|multa/i, 4],
];

const cleanMdText = (text: string): string =>
  text
    .replace(/\*\*/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[`_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const GREETING_RE = /^(estimad[oa]s?|saludos|atte|cordialmente)/i;
const OFFICIAL_SOURCE_RE = /bcn\.cl|leychile|pjud|dt\.gob\.cl|bcu\.cl|gob\.cl|diariooficial|boletinoficial|contraloria|sernac/i;

interface AnalysisReportProps {
  analysisMarkdown: string;
  userStory: string;
  area: LegalArea;
  notificationDate?: string;
  onSaveToHistory: () => void;
  isSaved: boolean;
  onNewAnalysis: () => void;
  isPaidInitial?: boolean;
  onPaymentSuccess?: () => void;
  premium?: PremiumResult | null;
  premiumFailed?: boolean;
  onRetryPremium?: () => void;
  isPremiumLoading?: boolean;
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
  analysisMarkdown,
  userStory,
  area,
  notificationDate,
  onSaveToHistory,
  isSaved,
  onNewAnalysis,
  isPaidInitial = false,
  onPaymentSuccess,
  premium = null,
  premiumFailed = false,
  onRetryPremium,
  isPremiumLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(isPaidInitial);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftPrefill, setDraftPrefill] = useState<DraftInput | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(analysisMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
    setIsPaymentModalOpen(false);
    if (onPaymentSuccess) {
      onPaymentSuccess();
    }
  };

  const userQuestionsCount = chatMessages.filter((m) => m.role === 'user').length;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked && userQuestionsCount >= 4) {
      setIsPaymentModalOpen(true);
      return;
    }
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');

    // Pass prior history before the current message
    const priorHistory = chatMessages.map((m) => ({ role: m.role, content: m.content }));

    const newMsgList: ChatMessage[] = [
      ...chatMessages,
      {
        id: Date.now().toString(),
        role: 'user',
        content: userMsg,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setChatMessages(newMsgList);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMsg,
          currentCaseContext: `DIAGNÓSTICO EN OBSERVACIÓN:\n${analysisMarkdown}\n\nRELATO INICIAL:\n${userStory}`,
          history: priorHistory,
        }),
      });

      const data = await response.json();

      // Detectar acción de generar borrador (LegalHelp IA)
      if (data.draftAction) {
        setDraftPrefill(data.suggestedInput);
        setShowDraftModal(true);
        
        // Agregar mensaje de confirmación al chat
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.reply || '✅ Detecté que quieres redactar un escrito. Te preparo el formulario con el contexto de tu caso.',
            timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      // 429: cuota diaria de IA agotada en todos los modelos -> CTA WhatsApp
      if (response.status === 429) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.error || 'El servicio de IA está temporalmente saturado. Si tu caso es urgente, escríbenos por WhatsApp y te atendemos directamente.',
            isQuotaExhausted: true,
            whatsappUrl: data.whatsapp || 'https://wa.me/56967658939',
            timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      const replyText = data.reply || data.error || 'Ocurrió un inconveniente procesando la consulta. Por favor intenta de nuevo.';

      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: replyText,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Error sending chat msg:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: 'Error de conexión al servidor. Revisa tu conexión e intenta nuevamente.',
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Parse markdown sections cleanly and handle preamble text correctly
  interface SectionData {
    title: string;
    body: string;
  }

  const parseMarkdownSections = (markdown: string): SectionData[] => {
    if (!markdown) return [];

    if (markdown.includes('## ')) {
      const rawChunks = markdown.split('## ').filter((chunk) => chunk.trim().length > 0);
      const sections: SectionData[] = [];
      let leadText = '';

      for (const chunk of rawChunks) {
        const trimmed = chunk.trim();
        const lines = trimmed.split('\n');
        const headerLine = lines[0].trim();

        // Check if header line starts with number "1.", "2." or section keywords
        const isHeaderChunk = /^(\d+[\.\)]|resumen|normativa|plazos|riesgos|próximos|pasos)/i.test(headerLine);

        if (!isHeaderChunk && sections.length === 0) {
          // Introductory text before section 1
          leadText = trimmed;
        } else {
          const title = headerLine.replace(/^#+\s*/, '');
          let body = lines.slice(1).join('\n').trim();
          if (body.length === 0) {
            body = trimmed;
          }
          if (leadText) {
            body = leadText + '\n\n' + body;
            leadText = '';
          }
          sections.push({ title, body });
        }
      }

      if (sections.length > 0) return sections;
    }

    const lines = markdown.trim().split('\n');
    const firstLine = lines[0]?.trim() || '1. Resumen de tu Situación Legal';
    const title = firstLine.replace(/^#+\s*/, '');
    const body = lines.slice(1).join('\n').trim() || markdown.trim();

    return [{ title, body }];
  };

  const parsedSections = parseMarkdownSections(analysisMarkdown);
  const premiumSections = premium?.report ? parseMarkdownSections(premium.report) : [];

  // Extrae los 2-3 riesgos más severos ya redactados en el dictamen (Punto 4 o 3).
  // Solo reordena/limita contenido existente: no inventa datos.
  const extractSevereRisks = (sections: SectionData[]): string[] => {
    const sourceSection =
      sections.find((s) => /^\s*4\s*[.)]/.test(s.title) && /riesgo/i.test(s.title)) ||
      sections.find((s) => /riesgo/i.test(s.title)) ||
      sections.find((s) => /^\s*3\s*[.)]/.test(s.title)) ||
      sections.find((s) => /plazo/i.test(s.title));
    const source = sourceSection?.body || '';
    if (!source) return [];

    // 1) Viñetas o lista numerada
    let items = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
      .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ''))
      .map(cleanMdText)
      .filter((t) => t.length >= 20 && !GREETING_RE.test(t));

    // 2) Fallback: oraciones del párrafo
    if (items.length < 2) {
      items = (cleanMdText(source).match(/[^.]+\.?/g) || [])
        .map((s) => s.trim())
        .filter((t) => t.length >= 30 && !GREETING_RE.test(t));
    }
    if (items.length === 0) return [];

    const scored = items.map((text, order) => ({
      text,
      order,
      score: RISK_KEYWORD_SCORES.reduce((acc, [re, w]) => (re.test(text) ? acc + w : acc), 0),
    }));

    const bySeverity = [...scored].sort((a, b) => b.score - a.score || a.order - b.order);
    const picked: Array<{ text: string; order: number; score: number }> = [];
    for (const item of bySeverity) {
      if (picked.length >= 3) break;
      if (picked.some((p) => p.text === item.text)) continue;
      picked.push(item);
    }

    return picked
      .map((p) => p.text)
      .map((t) => (t.length > 150 ? `${t.slice(0, 147).trim()}…` : t));
  };

  const severeRisks = isUnlocked ? [] : extractSevereRisks(parsedSections);
  const showDeadlineBadge = /plazo|fatal/i.test(analysisMarkdown);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header Badge */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded flex items-center justify-center font-bold shrink-0 ${
            isUnlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isUnlocked ? <CheckCircle2 className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {isUnlocked ? 'Diagnóstico Legal Completo Desbloqueado' : 'Resumen del Análisis Preliminar'}
              </h2>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${
                isUnlocked
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                {isUnlocked ? 'Pago Confirmado ($19.990 CLP)' : 'Resumen Gratuito'}
              </span>
            </div>
            {notificationDate && (
              <p className="text-xs text-slate-500 mt-0.5">
                Materia: <strong className="text-slate-800 uppercase">{area}</strong> • Fecha notificación: <strong className="text-slate-800">{notificationDate}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isUnlocked && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-amber-300" />
              <span>Desbloquear todo el informe por $19.990 CLP</span>
            </button>
          )}

          {isUnlocked && (
            <>
              <button
                onClick={handleCopy}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>
            </>
          )}

          <button
            onClick={onSaveToHistory}
            disabled={isSaved}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center justify-center gap-1.5 ${
              isSaved
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900 cursor-default font-semibold'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-500 shadow-sm'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>{isSaved ? 'Guardado' : 'Guardar'}</span>
          </button>

          <button
            onClick={onNewAnalysis}
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all ml-auto sm:ml-0"
          >
            Nuevo Caso
          </button>
        </div>
      </div>

      {/* Main Analysis Document Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm printable-area text-slate-800 leading-relaxed">
        
        {/* Document Stamp Header */}
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>INFORME PROCESAL Y DIAGNÓSTICO JURÍDICO CHILE • FECHA: {new Date().toLocaleDateString('es-CL')}</span>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1">
            {isUnlocked ? (
              <span>DICTAMEN TÉCNICO COMPLETO (100%)</span>
            ) : (
              <span className="text-blue-700 font-extrabold">VISTA PREVIA GRATUITA (ALERTAS DE URGENCIA)</span>
            )}
          </span>
        </div>

        {/* Formatted Markdown Content */}
        <div className="max-w-none space-y-6">
          {isUnlocked ? (
            <>
            {parsedSections.map((sec, idx) => {
              const { title, body } = sec;

              let icon = <Scale className="w-5 h-5 text-blue-600" />;
              let borderClass = 'border-l-4 border-blue-600 bg-slate-50 text-slate-900';
              let titleClass = 'text-slate-900';

              if (title.includes('1.')) {
                icon = <FileText className="w-5 h-5 text-blue-600" />;
                borderClass = 'border-l-4 border-blue-600 bg-blue-50/50';
              } else if (title.includes('2.')) {
                icon = <Scale className="w-5 h-5 text-blue-700" />;
                borderClass = 'border-l-4 border-slate-400 bg-slate-50';
              } else if (title.includes('3.')) {
                icon = <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
                borderClass = 'border-l-4 border-red-600 bg-red-50 text-red-950 font-medium';
                titleClass = 'text-red-900';
              } else if (title.includes('4.')) {
                icon = <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0" />;
                borderClass = 'border-l-4 border-orange-500 bg-orange-50 text-orange-950';
                titleClass = 'text-orange-900';
              } else if (title.includes('5.')) {
                icon = <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />;
                borderClass = 'border-l-4 border-blue-500 bg-blue-50/50 text-slate-900';
              }

              return (
                <div key={idx} className={`p-5 rounded-r-lg ${borderClass} space-y-3 shadow-xs`}>
                  <div className="flex items-center gap-2.5">
                    {icon}
                    <h3 className={`text-lg font-bold tracking-tight ${titleClass}`}>{title}</h3>
                  </div>
                  <div className="text-sm space-y-3 leading-relaxed whitespace-pre-line font-sans text-slate-800">
                    {body}
                  </div>
                </div>
              );
            })}

            {/* Complemento Web RAG: carga en curso (dictamen original ya visible) */}
            {isUnlocked && isPremiumLoading && (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50/70">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">Verificando el dictamen con búsqueda web oficial (Web RAG)…</p>
                  <p className="text-[11px] text-emerald-700">Contrastando artículos y plazos con fuentes oficiales (BCN, Ley Chile, PJUD, DT). Toma entre 10 y 30 segundos.</p>
                </div>
              </div>
            )}

            {/* Aviso de fallo premium: el dictamen normal se mantiene, pero el usuario queda al tanto */}
            {isUnlocked && !isPremiumLoading && premiumFailed && (
              <div className="mt-4 p-4 rounded-lg border-2 border-red-400 bg-red-50/80 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-red-900">El complemento de verificación premium no se pudo generar</h3>
                      <p className="text-xs text-red-800 mt-1">Tu dictamen sigue siendo válido. Puedes reintentarlo en unos minutos.</p>
                    </div>
                  </div>
                  {onRetryPremium && (
                    <button
                      onClick={onRetryPremium}
                      className="text-xs font-bold uppercase px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Complemento Web RAG: secciones de verificación + fuentes, ABAJO del dictamen original */}
            {isUnlocked && !isPremiumLoading && premium && (
              <>
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t-2 border-dashed border-emerald-300">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-1 bg-emerald-100 text-emerald-800 rounded border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Complemento de verificación
                  </span>
                  {premium.grounded && (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 bg-blue-100 text-blue-800 rounded border border-blue-200 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Búsqueda web oficial activa (Web RAG)
                    </span>
                  )}
                  {premium.bcn && premium.bcn.citados.length > 0 && (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 bg-indigo-100 text-indigo-800 rounded border border-indigo-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ley Chile · BCN ({premium.bcn.citados.length} arts. verificados)
                    </span>
                  )}
                  {premium.jurisprudencia && premium.jurisprudencia.length > 0 && (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 bg-purple-100 text-purple-800 rounded border border-purple-300 flex items-center gap-1">
                      <Scale className="w-3 h-3" /> Corte Suprema · Open Legal ({premium.jurisprudencia.length} fallos rectores)
                    </span>
                  )}
                  {premium.materia && (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      Materia: {premium.materia}
                    </span>
                  )}
                </div>
                {premiumSections.map((sec, idx) => {
                  const { title, body } = sec;
                  let icon = <ShieldCheck className="w-5 h-5 text-emerald-600" />;
                  let borderClass = 'border-l-4 border-emerald-500 bg-emerald-50/60';
                  let titleClass = 'text-emerald-950';
                  if (/criterio jur[ií]s|estrategia/i.test(title)) {
                    icon = <Scale className="w-5 h-5 text-purple-700" />;
                    borderClass = 'border-l-4 border-purple-600 bg-purple-50/50';
                    titleClass = 'text-purple-950';
                  } else if (/nulidad|punto ciego/i.test(title)) {
                    icon = <AlertCircle className="w-5 h-5 text-red-600" />;
                    borderClass = 'border-l-4 border-red-500 bg-red-50/60';
                    titleClass = 'text-red-950';
                  } else if (/verificaci[oó]n de art[ií]culos|art[ií]culos citados/i.test(title)) {
                    icon = <CheckCircle className="w-5 h-5 text-blue-700" />;
                    borderClass = 'border-l-4 border-blue-600 bg-blue-50/60';
                    titleClass = 'text-blue-950';
                  } else if (/fuente/i.test(title)) {
                    icon = <Globe className="w-5 h-5 text-slate-700" />;
                    borderClass = 'border-l-4 border-slate-500 bg-slate-50';
                    titleClass = 'text-slate-900';
                  }
                  return (
                    <div key={idx} className={`p-5 rounded-r-lg ${borderClass} space-y-3 shadow-xs`}>
                      <div className="flex items-center gap-2.5">
                        {icon}
                        <h3 className={`text-lg font-bold tracking-tight ${titleClass}`}>{title}</h3>
                      </div>
                      <div className="text-sm space-y-3 leading-relaxed whitespace-pre-line font-sans text-slate-800">
                        {body}
                      </div>
                    </div>
                  );
                })}
                {/* Panel de textos oficiales Ley Chile (BCN): verificación determinista, independiente del LLM */}
                {premium.bcn && premium.bcn.citados.length > 0 && (
                  <div className="p-5 rounded-r-lg border-l-4 border-indigo-600 bg-indigo-50/40 shadow-xs">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-700" />
                      <h3 className="text-lg font-bold tracking-tight text-indigo-950">Textos oficiales verificados (Ley Chile — BCN)</h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
                        Texto XML oficial · vigente
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs">
                      {premium.bcn.citados.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-indigo-600"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                          <span className="flex-1">
                            <span className="font-bold text-indigo-950">{a.nombreNorma}</span>
                            {', Art. '}
                            <span className="font-bold text-indigo-950">{a.articulo}</span>
                            {a.fechaVersion ? <span className="text-slate-500"> · versión vigente {a.fechaVersion}</span> : null}
                            {a.url && (
                              <>
                                {' · '}
                                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                                  Ver texto oficial en Ley Chile
                                </a>
                              </>
                            )}
                          </span>
                          {a.vigente && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                              Vigente
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-slate-500">
                      Fuente: Ley Chile — Biblioteca del Congreso Nacional de Chile (BCN), consultado al momento del análisis · CC BY-NC-ND 4.0.
                    </p>
                  </div>
                )}

                {/* Panel de jurisprudencia análoga (Open Legal Chile): fallos rectores de la Corte Suprema */}
                {premium.jurisprudencia && premium.jurisprudencia.length > 0 && (
                  <div className="p-5 rounded-r-lg border-l-4 border-purple-600 bg-purple-50/40 shadow-xs">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <Scale className="w-5 h-5 text-purple-700" />
                      <h3 className="text-lg font-bold tracking-tight text-purple-950">Jurisprudencia análoga (Corte Suprema)</h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-100 text-purple-800 rounded border border-purple-200">
                        Fallo rector · criterio dominante
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs">
                      {premium.jurisprudencia.map((j, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-purple-600"><Scale className="w-3.5 h-3.5" /></span>
                          <span className="flex-1">
                            <span className="font-bold text-purple-950">{j.institucion}</span>
                            {j.materia && <span className="text-slate-500"> · {j.materia}</span>}
                            {j.rolFalloRector && (
                              <>
                                {' · Fallo rector: '}
                                <span className="font-bold text-purple-950">CS Rol {j.rolFalloRector}</span>
                                {j.fechaFalloRector ? <span className="text-slate-500"> de {j.fechaFalloRector}</span> : null}
                                {` · `}
                                <a
                                  href="https://juris.pjud.cl/busqueda?Corte_Suprema"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 hover:underline"
                                >
                                  Buscar sentencia en el PJUD
                                </a>
                              </>
                            )}
                            {j.normas && j.normas.length > 0 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{j.normas.join(' · ')}</div>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-slate-500">
                      Fuente: Open Legal Chile (corpus público de jurisprudencia y doctrina chilena) · Consulta el fallo íntegro en el buscador del Poder Judicial con el rol indicado.
                      <br />
                      El criterio jurisprudencial es una estimación orientativa para apoyar tu decisión, no una garantía de resultado del juicio.
                    </p>
                  </div>
                )}

                {/* Panel de casos análogos recientes (CS/TC, doctrina cosechada) */}
                {premium.casos && premium.casos.length > 0 && (
                  <div className="p-5 rounded-r-lg border-l-4 border-fuchsia-600 bg-fuchsia-50/40 shadow-xs">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <Scale className="w-5 h-5 text-fuchsia-700" />
                      <h3 className="text-lg font-bold tracking-tight text-fuchsia-950">Casos análogos recientes</h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-fuchsia-100 text-fuchsia-800 rounded border border-fuchsia-200">
                        Doctrina del fallo · sintetizada
                      </span>
                    </div>
                    <ul className="space-y-3 text-xs">
                      {premium.casos.map((c, i) => (
                        <li key={i} className="border-b border-fuchsia-100 pb-2 last:border-b-0 last:pb-0">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="font-bold text-fuchsia-950">{c.tribunal}{c.sala ? ` · ${c.sala}` : ""}</span>
                            {c.rol && (
                              <>
                                {' · '}
                                <span className="font-bold">{c.rol}</span>
                                {c.fecha ? <span className="text-slate-500"> de {c.fecha}</span> : null}
                              </>
                            )}
                            {c.link && (
                              <a
                                href={c.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 hover:underline"
                              >
                                Texto del fallo
                              </a>
                            )}
                          </div>
                          {c.materia && <div className="text-[10px] text-slate-500 mt-0.5">{c.materia}</div>}
                          {c.doctrina && <p className="mt-1 text-slate-700">{c.doctrina}</p>}
                          {c.normas && <div className="text-[10px] text-slate-500 mt-0.5">{c.normas}</div>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-slate-500">
                      Fuente: corpus cosechado de Open Legal Chile (Corte Suprema reciente y Tribunal Constitucional). Sintetización automática de la doctrina del fallo: verifícala contra el texto íntegro antes de fijar criterio.
                      <br />
                      Estimación orientativa, no garantía de resultado.
                    </p>
                  </div>
                )}

                {/* Panel de blindaje: QA determinista del informe (roles/arts/montos) */}
                {premium.validacion && (
                  <div className="p-5 rounded-r-lg border-l-4 border-slate-500 bg-slate-50/70 shadow-xs">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <ShieldCheck className="w-5 h-5 text-slate-700" />
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">Trazabilidad automática del informe</h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded border border-slate-300">
                        QA local · sin IA
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 rounded border border-slate-200 bg-white">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Roles citados</div>
                        <div className="font-bold text-slate-900">
                          {premium.validacion.rolesEnCorpus.length} verificados
                          {premium.validacion.rolesNoEnCorpus.length > 0 && (
                            <span className="text-red-700"> · {premium.validacion.rolesNoEnCorpus.length} fuera del corpus</span>
                          )}
                        </div>
                      </div>
                      <div className="p-2.5 rounded border border-slate-200 bg-white">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Artículos</div>
                        <div className="font-bold text-slate-900">
                          {premium.validacion.artsCubiertos.length} con texto BCN
                          {premium.validacion.artsSinCobertura.length > 0 && (
                            <span className="text-amber-700"> · {premium.validacion.artsSinCobertura.length} sin cobertura</span>
                          )}
                        </div>
                      </div>
                      <div className="p-2.5 rounded border border-slate-200 bg-white">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Montos</div>
                        <div className="font-bold text-slate-900">
                          {premium.validacion.montosInforme} citados
                          {premium.validacion.montosNoCorroborados.length > 0 && (
                            <span className="text-amber-700"> · {premium.validacion.montosNoCorroborados.length} por revisar</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {premium.validacion.rolesNoEnCorpus.length > 0 && (
                      <div className="mt-3 text-[11px] text-red-800 bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-bold">Roles marcados NO VERIFICADOS:</span>{' '}
                        {premium.validacion.rolesNoEnCorpus.join(', ')} — confírmalos en el buscador del PJUD antes de citarlos.
                      </div>
                    )}
                    {premium.documentos && (premium.documentos.acciones.length > 0 || premium.documentos.articulosInvocados.length > 0) && (
                      <div className="mt-3 text-[11px] text-slate-600">
                        {premium.documentos.acciones.length > 0 && (
                          <div><span className="font-bold">Acciones detectadas:</span> {premium.documentos.acciones.join(' · ')}</div>
                        )}
                        {premium.documentos.articulosInvocados.length > 0 && (
                          <div className="mt-0.5"><span className="font-bold">Artículos invocados en tu documento:</span> {premium.documentos.articulosInvocados.join(', ')}</div>
                        )}
                      </div>
                    )}
                    <p className="mt-3 text-[10px] text-slate-500">
                      Contraste determinista hecho en el servidor sobre el texto final: ayuda a detectar cualquier error del modelo, no reemplaza tu criterio profesional.
                    </p>
                  </div>
                )}

                {/* Panel de fuentes oficiales consultadas */}
                {premium.sources.length > 0 && (
                  <div className="p-5 rounded-r-lg border-l-4 border-emerald-600 bg-white shadow-xs">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <Globe className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">Fuentes oficiales consultadas</h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                        {premium.sources.filter((s) => OFFICIAL_SOURCE_RE.test(`${s.domain || ''} ${s.title || ''}`)).length} / {premium.sources.length} oficiales
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {premium.sources.map((s, i) => {
                        const isOfficial = OFFICIAL_SOURCE_RE.test(`${s.domain || ''} ${s.title || ''}`);
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className={`mt-0.5 shrink-0 ${isOfficial ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isOfficial ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                            </span>
                            <a
                              href={s.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 hover:underline break-all flex items-center gap-1"
                            >
                              <span>{s.title || s.domain || s.uri}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            {isOfficial && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0 mt-0.5">
                                Oficial
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
            </>
          ) : (
            <>
              {/* ALERT CARD: vista previa gratuita de impacto (reemplaza el párrafo plano del Punto 1) */}
              <PreviewAlertCard
                risks={severeRisks}
                showDeadlineBadge={showDeadlineBadge}
                onUnlock={() => setIsPaymentModalOpen(true)}
              />

              {/* Puntos 2, 3, 4, 5...: Entirely blurred under a single payment button overlay */}
              {parsedSections.length > 1 && (
                <div className="relative rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6 overflow-hidden mt-6 shadow-sm">
                  {/* Blurred Background Content */}
                  <div className="filter blur-[6px] opacity-40 select-none space-y-5 pointer-events-none">
                    {parsedSections.slice(1).map((sec, idx) => {
                      const { title, body } = sec;

                      return (
                        <div key={idx} className="p-4 rounded-lg bg-slate-100 border border-slate-200 space-y-2">
                          <h4 className="font-bold text-slate-800 text-base">{title}</h4>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                            {body}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Single Central Overlay with Payment Button */}
                  <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px] flex flex-col items-center justify-center p-6 text-center space-y-3.5">
                    <div className="p-3.5 rounded-full bg-slate-900/90 border border-slate-700 text-amber-400 shadow-xl">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-lg sm:text-xl tracking-tight drop-shadow-md">
                        Desbloquear Diagnóstico Jurídico Completo
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-200 max-w-md mt-1 leading-relaxed">
                        Accede a la normativa aplicable, el cálculo exacto de plazos fatales, análisis de riesgos de embargo y el plan de acción legal recomendado.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="mt-2 px-7 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 transition-transform hover:scale-105 cursor-pointer border border-blue-400/40"
                    >
                      <CreditCard className="w-4 h-4 text-amber-300" />
                      <span>Desbloquear diagnóstico completo por $19.990 CLP (Pago Único)</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* PAYWALL CTA BOX (When Unpaid) */}
        {!isUnlocked && (
          <div className="mt-8 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl p-6 sm:p-8 shadow-xl border border-blue-800/80 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-blue-800/60 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded">
                      Pago Único • Acceso Definitivo
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mt-1">
                    Desbloquea Todos los Puntos del Dictamen Jurídico y Plan de Acción
                  </h3>
                </div>
              </div>

              <div className="text-left sm:text-right bg-white/10 px-4 py-2.5 rounded-lg border border-white/10">
                <span className="text-xs text-slate-300 font-semibold block">Pago único de acceso</span>
                <span className="text-2xl font-black text-amber-400">$19.990 CLP</span>
              </div>
            </div>

            {/* Included Features List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200">
              <div className="flex items-start gap-2.5 bg-white/5 p-3 rounded-lg border border-white/10">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Desglose de Normativa y Artículos:</strong> Fundamentación formal en el CPC, C. del Trabajo y Leyes Chilenas.</span>
              </div>
              <div className="flex items-start gap-2.5 bg-white/5 p-3 rounded-lg border border-white/10">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Cálculo Exacto de Plazos Finales:</strong> Días hábiles (Lunes a Sábado o Lunes a Viernes) y fecha límite exacta.</span>
              </div>
              <div className="flex items-start gap-2.5 bg-white/5 p-3 rounded-lg border border-white/10">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Riesgos Procesales y Embargos:</strong> Evaluación técnica para evitar rebeldía y pérdida de derechos.</span>
              </div>
              <div className="flex items-start gap-2.5 bg-white/5 p-3 rounded-lg border border-white/10">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Chat Ilimitado con Abogado IA:</strong> Resuelve todas tus preguntas específicas de la causa en tiempo real.</span>
              </div>
            </div>

            {/* Main Action Button */}
            <div className="pt-2 text-center space-y-2">
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 mx-auto border border-blue-400/40 cursor-pointer"
              >
                <CreditCard className="w-5 h-5 text-amber-300" />
                <span>Desbloquear todo el informe por $19.990 CLP</span>
              </button>
              <p className="text-[11px] text-slate-400">
                Acepta Webpay Plus (Débito/Crédito), Mercado Pago y Transferencias Bancarias Chilenas.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Interactive Chat Box for Follow-up Questions */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">¿Tienes dudas específicas sobre este dictamen?</h3>
              <p className="text-xs text-slate-500">
                {isUnlocked
                  ? 'Consultas ilimitadas activadas con el Abogado Litigante IA.'
                  : 'Puedes realizar hasta 4 consultas de orientación sobre tu caso.'}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {isUnlocked ? (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                Consultas Ilimitadas
              </span>
            ) : (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-100 text-blue-800 rounded border border-blue-300 flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3 text-blue-600" />
                {Math.max(0, 4 - userQuestionsCount)} de 4 Consultas Gratuitas
              </span>
            )}
          </div>
        </div>

        {/* Chat History Messages */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {chatMessages.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-700 font-medium">
                Escribe tu consulta legal sobre tu caso (4 preguntas gratuitas disponibles)
              </p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto italic">
                Ejemplos: "¿Qué hago si ya venció el plazo de notificación?", "¿Cómo consigo patrocinio en la CAJ?", "¿Dónde reviso mi causa en la Oficina Judicial Virtual (OJV)?"
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg text-xs max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto shadow-2xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 mr-auto shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1 opacity-80 text-[10px]">
                  <span className="font-bold">{msg.role === 'user' ? 'Tú' : 'Abogado Litigante IA'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                {msg.isQuotaExhausted && msg.whatsappUrl && (
                  <a
                    href={msg.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Atender por WhatsApp ahora
                  </a>
                )}
              </div>
            ))
          )}

          {isChatLoading && (
            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs max-w-[85%] mr-auto flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>El Abogado Litigante está analizando tu consulta...</span>
            </div>
          )}
        </div>

        {/* Chat Input Form or Limit Reached Banner */}
        {!isUnlocked && userQuestionsCount >= 4 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-amber-900 font-extrabold text-xs">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Has alcanzado el límite de 4 consultas gratuitas de orientación</span>
            </div>
            <p className="text-xs text-slate-700">
              Desbloquea el dictamen jurídico completo ($19.990 CLP) para continuar haciendo preguntas ilimitadas sobre tu causa.
            </p>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-300" />
              <span>Desbloquear dictamen completo por $19.990 CLP</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                !isUnlocked
                  ? `Haz una pregunta sobre tu caso (${Math.max(0, 4 - userQuestionsCount)} de 4 gratuitas)...`
                  : 'Escribe tu consulta adicional sobre la causa...'
              }
              disabled={isChatLoading}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Consultar</span>
            </button>
          </form>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handleUnlockSuccess}
        areaLabel={area.toUpperCase()}
      />

      {/* Draft Modal - LegalHelp IA */}
      {showDraftModal && draftPrefill && (
        <DraftModal
          initialData={draftPrefill}
          onClose={() => {
            setShowDraftModal(false);
            setDraftPrefill(null);
          }}
          onSuccess={(output) => {
            setChatMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'model',
                content: `✅ **Borrador de ${draftPrefill.tipo} generado**\n\nPuedes copiarlo, revisar la trazabilidad (QA) y usarlo como base para tu escrito.`,
                timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
            setShowDraftModal(false);
            setDraftPrefill(null);
          }}
        />
      )}

    </div>
  );
};
