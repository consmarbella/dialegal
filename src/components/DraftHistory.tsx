import React, { useState, useEffect } from 'react';
import { DraftOutput } from '../types';
import { FileText, Trash2, Clock, RotateCcw, Copy, Scale, Brain, MessageSquare, ShieldCheck, FileText as FileTextIcon, Copy as CopyIcon } from 'lucide-react';

interface DraftHistoryItem {
  id: string;
  timestamp: string;
  tipo: string;
  area: string;
  input: { hechos: string; pretensiones: string[] };
  output: DraftOutput;
}

const STORAGE_KEY = 'legalhelp_drafts';

export const DraftHistory: React.FC<{ onLoadDraft: (item: DraftHistoryItem) => void }> = ({ onLoadDraft }) => {
  const [history, setHistory] = useState<DraftHistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const saveDraft = (input: { hechos: string; pretensiones: string[]; tipo: string; area: string }, output: DraftOutput) => {
    const item: DraftHistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      tipo: input.tipo,
      area: input.area,
      input: { hechos: input.hechos, pretensiones: input.pretensiones },
      output,
    };
    const next = [item, ...history.slice(0, 19)];
    setHistory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const deleteDraft = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'demanda': return <Scale className="w-3.5 h-3.5" />;
      case 'contestacion': return <FileTextIcon className="w-3.5 h-3.5" />;
      case 'otrosi': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'minuta': return <RotateCcw className="w-3.5 h-3.5" />;
      case 'contrato': return <FileTextIcon className="w-3.5 h-3.5" />;
      case 'correo': return <CopyIcon className="w-3.5 h-3.5" />;
      default: return <Brain className="w-3.5 h-3.5" />;
    }
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case 'laboral': return 'bg-blue-100 text-blue-800';
      case 'civil': return 'bg-green-100 text-green-800';
      case 'familia': return 'bg-purple-100 text-purple-800';
      case 'penal': return 'bg-red-100 text-red-800';
      case 'administrativo': return 'bg-amber-100 text-amber-800';
      case 'constitucional': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <FileText className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-slate-700 font-semibold">Sin borradores guardados</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Tus escritos generados aparecerán aquí automáticamente. Se guardan localmente en el navegador (máx. 20).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          Historial de borradores ({history.length})
        </h3>
      </div>
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {history.map((item) => (
          <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                {getTipoIcon(item.tipo)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 truncate">{item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getAreaColor(item.area)}`}>
                    {item.area}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                  {item.input.hechos.slice(0, 100)}...
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(item.timestamp)}</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> QA: {item.output.validacion?.estructuraJudicial ? '✓' : '⚠'}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {item.output.draft.length} chars</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onLoadDraft(item)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Cargar
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(item.output.draft);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1"
                title="Copiar borrador"
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteDraft(item.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};