import React, { useState } from 'react';
import { LegalArea, ChatMessage } from '../types';
import { Scale, Download, Copy, BookmarkPlus, Send, MessageSquare, AlertCircle, CheckCircle, ShieldAlert, FileText, Lock, ShieldCheck, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import { PaymentModal } from './PaymentModal';

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
}) => {
  const [copied, setCopied] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(isPaidInitial);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

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
                {isUnlocked ? 'Pago Confirmado ($9.990 CLP)' : 'Resumen Gratuito'}
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
              <span>Desbloquear todo el informe por $9.990 CLP</span>
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
              <span className="text-blue-700 font-extrabold">VISTA PREVIA DE CASO (50% PUNTO 1)</span>
            )}
          </span>
        </div>

        {/* Formatted Markdown Content */}
        <div className="max-w-none space-y-6">
          {isUnlocked ? (
            parsedSections.map((sec, idx) => {
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
            })
          ) : (
            <>
              {/* Punto 1: 50% Visible Preview (Unblurred, Crisp & Clear Case Details) */}
              {parsedSections.slice(0, 1).map((sec, idx) => {
                const { title, body } = sec;
                const halfLength = Math.max(300, Math.ceil(body.length * 0.5));
                const previewText = body.length > halfLength ? body.slice(0, halfLength) : body;

                return (
                  <div key={idx} className="p-5 sm:p-6 rounded-r-lg border-l-4 border-blue-600 bg-blue-50/60 space-y-3 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between gap-2 border-b border-blue-200/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
                      </div>
                      <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md border border-blue-300 flex items-center gap-1 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        Vista Previa 50%
                      </span>
                    </div>

                    {/* Crisp Readable 50% Content */}
                    <div className="text-sm leading-relaxed whitespace-pre-line font-sans text-slate-800 pt-1">
                      {previewText}
                      {body.length > halfLength && (
                        <span className="text-blue-700 font-extrabold"> ... [50% restante protegido por pago]</span>
                      )}
                    </div>

                    {/* Locked Banner at Bottom of Punto 1 */}
                    <div className="mt-4 pt-3 text-xs font-semibold text-slate-700 bg-blue-100/60 border border-blue-200/80 px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>El 50% restante de la síntesis de tu caso y los Puntos 2 a 5 se desbloquean al realizar el pago.</span>
                      </div>
                      <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="text-[11px] font-black text-blue-700 hover:text-blue-900 underline whitespace-nowrap cursor-pointer"
                      >
                        Desbloquear &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}

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
                      <span>Desbloquear diagnóstico completo por $9.990 CLP (Pago Único)</span>
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
                <span className="text-2xl font-black text-amber-400">$9.990 CLP</span>
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
                <span>Desbloquear todo el informe por $9.990 CLP</span>
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
              Desbloquea el dictamen jurídico completo ($9.990 CLP) para continuar haciendo preguntas ilimitadas sobre tu causa.
            </p>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-300" />
              <span>Desbloquear dictamen completo por $9.990 CLP</span>
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

    </div>
  );
};
