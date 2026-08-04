import React, { useState } from 'react';
import { PROCEDURAL_PRESETS } from '../data/chileanLegalData';
import { calculateChileanDeadline, formatDateChile } from '../utils/deadlineCalculator';
import { Calculator, Calendar, AlertTriangle, Lock, ShieldAlert, CreditCard } from 'lucide-react';

interface DeadlineCalculatorProps {
  isUnlocked?: boolean;
  onOpenPayment?: () => void;
}

export const DeadlineCalculatorComponent: React.FC<DeadlineCalculatorProps> = ({
  isUnlocked = false,
  onOpenPayment,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PROCEDURAL_PRESETS[0].id);
  const [startDateStr, setStartDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customDays, setCustomDays] = useState<number>(18);
  const [customType, setCustomType] = useState<'habiles_cpc' | 'habiles_laboral' | 'corridos'>('habiles_cpc');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const activePreset = PROCEDURAL_PRESETS.find((p) => p.id === selectedPresetId) || PROCEDURAL_PRESETS[0];

  const daysNumber = isCustom ? customDays : activePreset.days;
  const deadlineType = isCustom ? customType : activePreset.type;

  const result = calculateChileanDeadline(startDateStr, daysNumber, deadlineType);
  const targetDateFormatted = formatDateChile(new Date(result.targetDate + 'T00:00:00'));

  return (
    <div className="space-y-6">
      
      {/* Title & Introduction */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Calculadora de Plazos Finales Procedimentales de Chile</h2>
            <p className="text-xs text-slate-500">
              Cálculo de días hábiles procesales conforme al Art. 66 del CPC (Lunes a Sábado), Código del Trabajo (Lunes a Viernes) y feriados en Chile.
            </p>
          </div>
        </div>
        <div className="text-xs bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg text-orange-900 font-bold flex items-center gap-1.5 shrink-0">
          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
          <span>¡Regla de Oro!: El plazo corre al día siguiente de la notificación legal.</span>
        </div>
      </div>

      {!isUnlocked && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800 rounded-xl p-6 text-white text-center shadow-lg space-y-4">
          <div className="inline-flex p-3 rounded-full bg-blue-600/30 border border-blue-400/40 text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-white">
            Calculadora de Plazos Finales Bloqueada
          </h3>
          <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
            Ingresa los antecedentes de tu caso en la pantalla principal para activar el diagnóstico. La calculadora se desbloquea en tiempo real al realizar el pago único del informe.
          </p>
          <button
            onClick={onOpenPayment}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-amber-300" />
            <span>Desbloquear todo el informe por $9.990 CLP</span>
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 relative ${!isUnlocked ? 'filter blur-[3px] opacity-40 pointer-events-none select-none' : ''}`}>
        
        {/* Left Column: Input Form & Presets */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              1. Selecciona Trámite / Plazo Frecuente
            </label>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {PROCEDURAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setIsCustom(false);
                  }}
                  className={`w-full text-left p-2.5 rounded border text-xs transition-all ${
                    !isCustom && selectedPresetId === preset.id
                      ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <p className="font-semibold">{preset.name}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{preset.article}</p>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`w-full text-left p-2.5 rounded border text-xs transition-all ${
                  isCustom
                    ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                ⚙️ Configurar Plazo Personalizado
              </button>
            </div>
          </div>

          {/* Custom controls if custom selected */}
          {isCustom && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div>
                <label className="block text-xs text-slate-700 mb-1 font-semibold">Número de días:</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1 font-semibold">Tipo de días:</label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="habiles_cpc">Días hábiles CPC (Lunes a Sábado, sin domingos ni festivos)</option>
                  <option value="habiles_laboral">Días hábiles Laboral/Admin (Lunes a Viernes)</option>
                  <option value="corridos">Días corridos (Días de calendario continuos)</option>
                </select>
              </div>
            </div>
          )}

          {/* Notification Date Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              2. Fecha de Notificación Legal
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Fecha en que te entregaron la cédula o notificación oficial.
            </p>
          </div>

        </div>

        {/* Right Columns: Results Card & Legal Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Result Banner */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6 text-slate-900">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  {!isCustom ? activePreset.code : 'Plazo Personalizado'}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {!isCustom ? activePreset.name : `${customDays} días (${customType})`}
                </h3>
                <p className="text-xs text-blue-800 font-mono font-medium mt-1">
                  {!isCustom ? activePreset.article : ''}
                </p>
              </div>

              {/* Days Remaining Badge */}
              <div
                className={`px-4 py-2.5 rounded-lg border text-center shadow-xs ${
                  result.isExpired
                    ? 'bg-red-100 border-red-300 text-red-900'
                    : result.daysRemaining <= 3
                    ? 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse'
                    : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                }`}
              >
                <span className="block text-[10px] uppercase font-bold tracking-widest opacity-80">
                  {result.isExpired ? '¡PLAZO VENCIDO!' : 'TE QUEDAN'}
                </span>
                <span className="text-2xl font-extrabold tracking-tight">
                  {result.isExpired
                    ? `${Math.abs(result.daysRemaining)} DÍAS VENCIDO`
                    : `${result.daysRemaining} DÍAS CALENDARIO`}
                </span>
              </div>
            </div>

            {/* Target Expiration Date Big Box */}
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
              <span className="text-xs uppercase font-bold text-blue-900 tracking-wider">
                FECHA DE VENCIMIENTO Y VENCIMIENTO DE PLAZO FATAL:
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-blue-900 capitalize tracking-tight">
                {targetDateFormatted}
              </p>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                {result.typeExplanation}
              </p>
            </div>

            {/* Computation Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <span className="block text-lg font-bold text-slate-900">{result.totalDaysAdded}</span>
                <span className="text-[11px] text-slate-500">Días fijados por Ley</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <span className="block text-lg font-bold text-amber-700">{result.sundaysSkipped}</span>
                <span className="text-[11px] text-slate-500">Domingos Inhábiles</span>
              </div>

              {result.saturdaysSkipped !== undefined && result.saturdaysSkipped > 0 && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <span className="block text-lg font-bold text-blue-700">{result.saturdaysSkipped}</span>
                  <span className="text-[11px] text-slate-500">Sábados excluidos</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <span className="block text-lg font-bold text-indigo-700">{result.holidaysSkipped.length}</span>
                <span className="text-[11px] text-slate-500">Feriados en Chile</span>
              </div>
            </div>

            {/* List of holidays skipped if any */}
            {result.holidaysSkipped.length > 0 && (
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong className="text-amber-800">Feriados descontados en el período:</strong>{' '}
                {result.holidaysSkipped.map((f) => formatDateChile(new Date(f + 'T00:00:00'))).join(', ')}.
              </div>
            )}

            {/* Warning consequence if missed */}
            {!isCustom && (
              <div className="p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg space-y-1.5 text-xs text-red-950 font-medium">
                <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  Consecuencia Legal Inminente si no se actúa a tiempo:
                </div>
                <p className="leading-relaxed text-red-900/90">{activePreset.consequenceIfMissed}</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

