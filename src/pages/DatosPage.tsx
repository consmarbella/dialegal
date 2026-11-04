import React, { useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import type { ResultadoDatosScanner } from '../server/datosScanner';

interface DatosPageProps {
  onOpenPayment?: () => void;
}

const PASOS = [
  'Accediendo a la URL…',
  'Mapeando formularios DOM…',
  'Evaluando reglas de la Ley 21.719…',
  'Generando diagnóstico…',
];

export const DatosPage: React.FC<DatosPageProps> = ({ onOpenPayment }) => {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResultadoDatosScanner | null>(null);

  const nivelColor = useMemo(() => {
    switch (result?.nivel) {
      case 'Bajo': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Medio': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Alto': return 'bg-orange-100 text-orange-900 border-orange-300';
      default: return 'bg-red-100 text-red-900 border-red-300';
    }
  }, [result?.nivel]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    let idx = 0;
    setPaso(0);
    const timer = window.setInterval(() => {
      idx += 1;
      if (idx < PASOS.length) setPaso(idx);
    }, 900);
    setLoading(true);
    try {
      const res = await fetch('/api/datos/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: email.trim(), autorizado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setError(data?.error || 'No se pudo completar la auditoría.');
        return;
      }
      setPaso(PASOS.length - 1);
      setResult(data as ResultadoDatosScanner);
    } catch {
      setError('Error de red al contactar el servidor.');
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg">
        <p className="text-xs font-extrabold uppercase tracking-widest text-cyan-300">Scanner Express</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">Auditoría de preparación Ley 21.719</h1>
        <p className="text-slate-300 text-sm mt-2 leading-relaxed">
          Diagnóstico determinista (sin IA) de formularios, políticas y terceros en tu sitio. La ley tiene vigencia diferida (1-dic-2026; proyecto al 15-oct-2027): este reporte mide preparación, no infracción vigente.
        </p>
      </header>

      <form onSubmit={run} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">URL de tu sitio web</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tienda.cl"
            inputMode="url"
            className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Correo para el informe</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.cl"
            type="email"
            inputMode="email"
            className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
            required
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} className="mt-1" required />
          <span>Soy titular o estoy autorizado para auditar este dominio. Entiendo que el escaneo es de superficie pública y sin acceso a áreas privadas.</span>
        </label>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button
          disabled={loading || !autorizado}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold px-6 py-3 rounded-xl shadow"
          type="submit"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {loading ? PASOS[paso] : 'Auditar Cumplimiento Ley 21.719'}
        </button>
      </form>

      {loading && (
        <div aria-live="polite" className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          <span className="font-mono">{PASOS[paso]}</span>
        </div>
      )}

      {result && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="text-5xl font-extrabold text-slate-900">{result.score}<span className="text-xl text-slate-500">/100</span></div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wide text-slate-500">Nivel de riesgo</p>
              <span className={`inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full border font-extrabold text-sm ${nivelColor}`}>
                <AlertTriangle className="w-4 h-4" /> {result.nivel}
              </span>
              <p className="text-xs text-slate-500 mt-2">{result.url} · {result.tiempoMs} ms</p>
            </div>
          </div>

          {result.hallazgos.length === 0 ? (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">Sin hallazgos de superficie en esta pasada. Revisa igual flujos paginados, checkout y móvil.</p>
          ) : (
            <ul className="space-y-3">
              {result.hallazgos.map((h) => (
                <li key={h.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${h.gravedad === 'critica' ? 'bg-red-100 text-red-900 border-red-300' : h.gravedad === 'alta' ? 'bg-orange-100 text-orange-900 border-orange-300' : 'bg-amber-50 text-amber-900 border-amber-200'}`}>
                      {h.gravedad}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{h.id}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mt-1">{h.titulo}</h3>
                  <p className="text-sm text-slate-700 mt-1">{h.detalle}</p>
                  <p className="text-xs text-slate-500 mt-1">Fundamento: {h.fundamento}{h.pagina ? ` · ${h.pagina}` : ''}</p>
                  {h.evidencia && <p className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2 break-words">{h.evidencia}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onOpenPayment} className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-3 rounded-xl">
              Regularizar mi sitio con el Widget ARSOP + RAT <ArrowRight className="w-4 h-4" />
            </button>
            <a href="/datos" className="inline-flex items-center justify-center border border-slate-300 rounded-xl px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">Compartir reporte</a>
          </div>
          <p className="text-[11px] text-slate-500">{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
};
