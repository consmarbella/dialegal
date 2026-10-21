import React, { useState } from 'react';
import { DraftInput, DraftOutput } from '../types';
import { DraftModal } from './DraftModal';
import { FlaskConical, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export const APP_VERSION = 'v10-draft-test';

interface TestResult {
  frase: string;
  draftAction?: boolean;
  suggestedTipo?: string;
  cached?: boolean;
  raw: string;
  ok?: boolean;
  error?: string;
}

const FRASES = [
  'Generar borrador de contestación de demanda',
  'redactar la contestación',
  'hacer la demanda',
  'Necesito un borrador de contestación',
  '¿Me puedes redactar un otrosí?',
];

const CONTEXTO = `DIAGNÓSTICO EN OBSERVACIÓN:
## 1. Resumen
Caso laboral despido

RELATO INICIAL:
PRIMERO: Fui contratado el 15/03/2024. SEGUNDO: Despedido el 02/09/2026 por art. 161 sin hechos.`;

export const TestDraftPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [prefill, setPrefill] = useState<DraftInput | null>(null);
  const [finalDraft, setFinalDraft] = useState<DraftOutput | null>(null);

  const runTest = async (frase: string) => {
    setIsLoading(frase);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: frase, currentCaseContext: CONTEXTO, history: [] }),
      });
      const data = await res.json();
      setResults((prev) => [
        ...prev.filter((r) => r.frase !== frase),
        {
          frase,
          draftAction: data.draftAction,
          suggestedTipo: data.suggestedTipo,
          cached: data.cached,
          raw: JSON.stringify(data, null, 2).slice(0, 600),
          ok: true,
        },
      ]);
      if (data.draftAction && data.suggestedInput) {
        setPrefill(data.suggestedInput as DraftInput);
      }
    } catch (e: any) {
      setResults((prev) => [
        ...prev.filter((r) => r.frase !== frase),
        { frase, raw: e.message, ok: false, error: e.message },
      ]);
    } finally {
      setIsLoading(null);
    }
  };

  const runAll = () => FRASES.forEach((f) => runTest(f));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-white" />
            <div>
              <h1 className="text-white text-lg font-bold">Panel de Prueba: Detección de Borrador</h1>
              <p className="text-blue-100 text-xs">
                Bundle {APP_VERSION} · {new Date().toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Este panel llama directamente a <code className="bg-slate-100 px-1 rounded">/api/chat</code> con un caso
            sintético. No necesitas subir demanda. Si la detección funciona, se abrirá el modal LegalHelp IA.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={runAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" /> Probar todas las frases
            </button>
            {FRASES.map((f) => (
              <button
                key={f}
                onClick={() => runTest(f)}
                disabled={isLoading !== null}
                className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition disabled:opacity-50"
              >
                {isLoading === f ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {f}
              </button>
            ))}
          </div>

          {results.map((r) => (
            <div
              key={r.frase}
              className={`rounded-lg border p-4 ${
                r.ok ? (r.draftAction ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50') : 'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {r.ok ? (
                  r.draftAction ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-amber-600" />
                  )
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-semibold text-sm text-slate-800">"{r.frase}"</span>
                {r.draftAction && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="ml-auto px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                  >
                    Abrir modal borrador →
                  </button>
                )}
              </div>
              {r.draftAction && (
                <p className="text-xs text-slate-600 mb-1">
                  detectedTipo: <b>{r.suggestedTipo}</b> · cached: <b>{String(r.cached)}</b> · latest: <b>{APP_VERSION}</b>
                </p>
              )}
              <pre className="text-[10px] bg-white/70 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {r.raw}
              </pre>
            </div>
          ))}

          {finalDraft && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4">
              <p className="font-semibold text-green-800 text-sm">✅ Borrador completo generado por el endpoint /api/legalhelp/draft</p>
              <pre className="text-[10px] mt-2 whitespace-pre-wrap max-h-40 overflow-auto">{finalDraft.markdown?.slice(0, 500)}</pre>
            </div>
          )}
        </div>
      </div>

      {showModal && prefill && (
        <DraftModal
          initialData={prefill}
          onClose={() => setShowModal(false)}
          onSuccess={(out) => {
            setFinalDraft(out);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};
