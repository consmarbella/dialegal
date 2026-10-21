import React, { useState, useCallback } from 'react';
import { DraftForm } from '../components/DraftForm';
import { DraftResult } from '../components/DraftResult';
import { DraftHistory } from '../components/DraftHistory';
import { DraftInput, DraftOutput } from '../types';
import { Scale, ChevronLeft, Sparkles } from 'lucide-react';

export const LegalHelpDraft: React.FC = () => {
  const [view, setView] = useState<'form' | 'result'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<DraftOutput | null>(null);
  const [lastInput, setLastInput] = useState<DraftInput | null>(null);

  const handleSubmit = useCallback(async (input: DraftInput) => {
    setIsLoading(true);
    setLastInput(input);
    try {
      const res = await fetch('/api/legalhelp/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      setCurrentDraft(data);
      setView('result');
    } catch (err: any) {
      alert(`Error generando borrador: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegenerate = useCallback(async (respuestasAuditoria?: string) => {
    if (!lastInput) return;
    setIsLoading(true);
    try {
      const body = respuestasAuditoria?.trim()
        ? JSON.stringify({ ...lastInput, respuestasAuditoria })
        : JSON.stringify({ ...lastInput, _regenerate: true });
      const res = await fetch('/api/legalhelp/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `Error ${res.status}`);
      setCurrentDraft(data);
    } catch (err: any) {
      alert(`Error regenerando: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [lastInput]);

  const handleLoadDraft = useCallback((item: { output: DraftOutput; input: { hechos: string; pretensiones: string[]; tipo: string; area: string } }) => {
    setCurrentDraft(item.output);
    setLastInput({
      tipo: item.input.tipo as any,
      area: item.input.area as any,
      hechos: item.input.hechos,
      pretensiones: item.input.pretensiones,
    });
    setView('result');
  }, []);

  const handleNewDraft = useCallback(() => {
    setCurrentDraft(null);
    setLastInput(null);
    setView('form');
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header simplificado */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Volver al inicio"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">LegalHelp IA</h1>
                  <p className="text-[11px] text-slate-500">Motor forense de redacción procesal</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-[10px] font-bold uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> MVP
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Columna principal */}
          <div className="space-y-6">
            {view === 'form' ? (
              <DraftForm onSubmit={handleSubmit} isLoading={isLoading} />
            ) : (
              <>
                <DraftResult
                  output={currentDraft!}
                  onRegenerate={handleRegenerate}
                  onNewDraft={handleNewDraft}
                />
              </>
            )}
          </div>

          {/* Sidebar: Historial */}
          <div className="hidden lg:block">
            <DraftHistory onLoadDraft={handleLoadDraft} />
          </div>
        </div>

        {/* Mobile history toggle */}
        <div className="lg:hidden mt-6">
          <DraftHistory onLoadDraft={handleLoadDraft} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          <p>LegalHelp IA — Motor forense de redacción procesal para profesionales del derecho en Chile</p>
          <p className="mt-1 text-[11px]">Borradores con trazabilidad automática (QA local) · Basado en corpus Open Legal + Ley Chile BCN</p>
        </div>
      </footer>
    </div>
  );
};