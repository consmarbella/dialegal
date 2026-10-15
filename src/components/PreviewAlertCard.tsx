import React from 'react';
import { AlertTriangle, Lock, Siren, CalendarX2, ListChecks } from 'lucide-react';

interface PreviewAlertCardProps {
  risks: string[];
  showDeadlineBadge: boolean;
  onUnlock: () => void;
}

const RedactedBar: React.FC<{ widthClass: string; label: string }> = ({ widthClass, label }) => (
  <span
    role="img"
    aria-label={`${label} bloqueado`}
    title="Contenido censurado — se revela al desbloquear el informe completo"
    className={`inline-flex items-center justify-center h-5 rounded-sm bg-slate-950 border border-slate-700/80 align-middle shrink-0 ${widthClass} cursor-not-allowed select-none`}
  >
    <span className="text-transparent text-[13px] leading-none tracking-widest px-1">████████</span>
  </span>
);

export const PreviewAlertCard: React.FC<PreviewAlertCardProps> = ({
  risks,
  showDeadlineBadge,
  onUnlock,
}) => {
  return (
    <div className="relative rounded-r-lg border border-l-4 border-blue-950 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-md p-5 sm:p-6 space-y-4 overflow-hidden">
      {/* Cinta de urgencia superior */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950" />

      {/* Encabezado + Badge de plazo fatal (sin revelar el día) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3 pt-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <Siren className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              ALERTA DE URGENCIA — TU CASO
            </h3>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Riesgos severos detectados en tu demanda o resolución
            </p>
          </div>
        </div>
        {showDeadlineBadge && (
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-[11px] font-black uppercase tracking-widest animate-pulse shadow-lg border border-red-400/60">
            <AlertTriangle className="w-3.5 h-3.5" />
            Plazo Fatal en Curso
          </span>
        )}
      </div>

      {/* Lista de riesgos extraídos del dictamen */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            {risks.length} {risks.length === 1 ? 'Riesgo Severo Identificado' : 'Riesgos Severos Identificados'}
          </p>
          <ol className="space-y-2">
            {risks.map((risk, i) => (
              <li
                key={i}
                className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg px-3.5 py-3 shadow-xs"
              >
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-md bg-blue-950 text-white text-[11px] font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm font-bold text-slate-900 leading-snug flex-1">{risk}</span>
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-1" />
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Campos bloqueados con efecto redacted/censurado */}
      <div className="bg-slate-900 rounded-lg p-4 space-y-3 border border-slate-700 shadow-inner">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Campos Bloqueados — Dictamen Completo
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 min-w-0">
            <CalendarX2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Fecha Exacta de Vencimiento</span>
          </span>
          <RedactedBar widthClass="w-32 sm:w-40" label="Fecha exacta de vencimiento" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 min-w-0">
            <ListChecks className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Pasos de Defensa (Plan de Acción)</span>
          </span>
          <RedactedBar widthClass="w-40 sm:w-56" label="Pasos de defensa" />
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-700/70">
          La fecha límite exacta de vencimiento y el plan de defensa paso a paso se revelan al
          desbloquear el dictamen jurídico completo.
        </p>
      </div>

      {/* Barra de bloqueo + CTA */}
      <div className="mt-1 pt-3 text-xs font-semibold text-slate-700 bg-amber-100/70 border border-amber-200 px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            La síntesis completa de tu caso y los Puntos 1 a 5 del dictamen se desbloquean al
            realizar el pago.
          </span>
        </div>
        <button
          onClick={onUnlock}
          className="text-[11px] font-black text-blue-700 hover:text-blue-900 underline whitespace-nowrap cursor-pointer"
        >
          Desbloquear &rarr;
        </button>
      </div>
    </div>
  );
};
