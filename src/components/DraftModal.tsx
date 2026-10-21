import React, { useState } from 'react';
import { DraftInput, DraftOutput } from '../types';
import { DraftForm } from './DraftForm';
import { DraftResult } from './DraftResult';
import { X, Loader2, Scale, FileText, ShieldCheck } from 'lucide-react';

interface DraftModalProps {
  initialData: DraftInput;
  onClose: () => void;
  onSuccess: (output: DraftOutput) => void;
}

export const DraftModal: React.FC<DraftModalProps> = ({ initialData, onClose, onSuccess }) => {
  const [view, setView] = useState<'form' | 'result'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<DraftOutput | null>(null);
  // Key para remontar el formulario si cambia el prefill (datos frescos del diagnóstico)
  const formKey = `${initialData?.tipo}-${JSON.stringify(initialData?.rol || '')}-${JSON.stringify(initialData?.tribunal || '')}-${JSON.stringify(initialData?.pretensiones || []).length}`;

  const handleSubmit = async (formInput: DraftInput) => {
    // El formulario reconstruye el objeto desde sus campos visibles; los campos
    // heredados del análisis (dictamen + documento del caso) se preservan aparte.
    const inherited: Partial<DraftInput> = {};
    for (const key of ['dictamen', 'documentoCaso'] as const) {
      if (initialData?.[key]) inherited[key] = initialData[key];
    }
    const input: DraftInput = { ...formInput, ...inherited };
    setIsLoading(true);
    try {
      const res = await fetch('/api/legalhelp/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setCurrentDraft(data);
      setView('result');
    } catch (err: any) {
      alert(`Error generando borrador: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (initialData) handleSubmit(initialData);
  };

  const handleNewDraft = () => {
    setView('form');
    setCurrentDraft(null);
  };

  const handleClose = () => {
    if (view === 'result') {
      setView('form');
      setCurrentDraft(null);
    } else {
      onClose();
    }
  };

  // Modal styles
  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
  };

  const modalContentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflow: 'hidden',
    backgroundColor: 'white',
    borderRadius: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{view === 'form' ? 'Generar borrador judicial' : 'Borrador generado'}</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded font-bold uppercase border ${
                  initialData.area === 'laboral' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  initialData.area === 'civil' ? 'bg-green-100 text-green-800 border-green-200' :
                  initialData.area === 'familia' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  initialData.area === 'penal' ? 'bg-red-100 text-red-800 border-red-200' :
                  initialData.area === 'administrativo' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}>
                  {initialData.area}
                </span>
                <span className="px-2 py-0.5 rounded font-bold uppercase border bg-slate-100 text-slate-700 border-slate-200">
                  {initialData.tipo}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {view === 'form' ? (
            <DraftForm
              key={formKey}
              initialData={initialData}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          ) : (
            <DraftResult
              output={currentDraft!}
              onRegenerate={handleRegenerate}
              onNewDraft={handleNewDraft}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Incluye trazabilidad automática (QA local) y verificación BCN</span>
          </div>
          {view === 'result' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Copiar y cerrar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};