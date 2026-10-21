import React, { useState, useEffect } from 'react';
import { DraftInput, DraftTipo, DraftArea } from '../types';
import { FileText, Scale, MessageSquare, PenTool, Mail, X, Loader2, Brain, AlertTriangle, FilePlus2 } from 'lucide-react';

interface DraftFormProps {
  onSubmit: (input: DraftInput) => Promise<void>;
  isLoading: boolean;
  initialData?: Partial<DraftInput>;
}

const TIPO_LABELS: Record<DraftTipo, { label: string; icon: React.ReactNode; desc: string }> = {
  demanda: { label: "Demanda", icon: <Scale className="w-4 h-4" />, desc: "Demanda laboral, civil, familiar, etc." },
  contestacion: { label: "Contestación", icon: <FileText className="w-4 h-4" />, desc: "Contestación de demanda con excepciones y negativa" },
  otrosi: { label: "Otrosí", icon: <MessageSquare className="w-4 h-4" />, desc: "Notificación, prueba, medida cautelar, incidente" },
  minuta: { label: "Minuta", icon: <PenTool className="w-4 h-4" />, desc: "Minuta de audiencia (preparatoria, juicio, conciliación)" },
  contrato: { label: "Contrato", icon: <FileText className="w-4 h-4" />, desc: "Contrato civil, comercial, laboral, servicios" },
  correo: { label: "Correo", icon: <Mail className="w-4 h-4" />, desc: "Comunicación formal a tribunal, contraparte, cliente" },
};

const AREA_LABELS: Record<DraftArea, { label: string; color: string }> = {
  laboral: { label: "Laboral", color: "bg-blue-100 text-blue-800" },
  civil: { label: "Civil", color: "bg-green-100 text-green-800" },
  familia: { label: "Familia", color: "bg-purple-100 text-purple-800" },
  penal: { label: "Penal", color: "bg-red-100 text-red-800" },
  administrativo: { label: "Administrativo", color: "bg-amber-100 text-amber-800" },
  constitucional: { label: "Constitucional", color: "bg-indigo-100 text-indigo-800" },
};

export const DraftForm: React.FC<DraftFormProps> = ({ onSubmit, isLoading, initialData }) => {
  const [tipo, setTipo] = useState<DraftTipo>(initialData?.tipo || "demanda");
  const [area, setArea] = useState<DraftArea | "auto">(initialData?.area || "auto");
  const [hechos, setHechos] = useState(initialData?.hechos || "");
  const [pretensiones, setPretensiones] = useState<string[]>(initialData?.pretensiones?.length ? initialData.pretensiones : [""]);
  const [documentos, setDocumentos] = useState<string[]>(initialData?.documentos || []);
  const [rol, setRol] = useState(initialData?.rol || "");
  const [tribunal, setTribunal] = useState(initialData?.tribunal || "");
  const [antecedentes, setAntecedentes] = useState("");
  const [showAntecedentes, setShowAntecedentes] = useState(false);
  const [areaConfidence, setAreaConfidence] = useState<number | null>(null);
  const [showDocumentos, setShowDocumentos] = useState(false);

  const tienePrefillDiagnostico = !!initialData?.hechos || (initialData?.pretensiones?.length || 0) > 0;

  // Auto-detect area cuando cambian hechos/pretensiones
  useEffect(() => {
    if (area === "auto" && (hechos.length > 50 || pretensiones.some(p => p.length > 20))) {
      // Simulación simple de confianza (el backend hace la real)
      const texto = [hechos, ...pretensiones].join(" ").toLowerCase();
      let scores = { laboral: 0, civil: 0, familia: 0, penal: 0, administrativo: 0, constitucional: 0 };
      const keywords = {
        laboral: ["despido", "cotiz", "feriado", "horas extra", "acoso", "karin", "tutela", "indemniz", "años de servicio", "fuero", "carta de despido"],
        civil: ["daños", "perjuicios", "contrato", "incumplim", "resolución", "cobro", "ejecutivo", "arrendam", "desahucio", "usucapión", "prescripción"],
        familia: ["alimentos", "cuota aliment", "cuidado personal", "visitas", "divorcio", "cese de conviv", "compensación económica", "gananciales"],
        penal: ["querella", "denuncia", "delito", "imputado", "víctima", "prisión preventiva", "sobreseimiento", "formalización", "fiscalía"],
        administrativo: ["recurso de protección", "ilegalidad", "acto administrativo", "municipalidad", "servicio público", "contraloría", "decreto"],
        constitucional: ["derechos fundamentales", "inconstitucional", "tribunal constitucional", "igualdad", "debido proceso", "habeas corpus"],
      };
      for (const [a, kws] of Object.entries(keywords)) {
        for (const kw of kws) {
          if (texto.includes(kw)) scores[a as keyof typeof scores]++;
        }
      }
      const maxArea = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      setAreaConfidence(maxArea[1] > 0 ? Math.min(1, maxArea[1] / 5) : null);
    }
  }, [hechos, pretensiones, area]);

  const handleAddPretension = () => setPretensiones([...pretensiones, ""]);
  const handleRemovePretension = (idx: number) => setPretensiones(pretensiones.filter((_, i) => i !== idx));
  const handlePretensionChange = (idx: number, value: string) => {
    const next = [...pretensiones];
    next[idx] = value;
    setPretensiones(next);
  };

  const handleAddDocumento = () => {
    setDocumentos([...documentos, ""]);
    setShowDocumentos(true);
  };
  const handleRemoveDocumento = (idx: number) => setDocumentos(documentos.filter((_, i) => i !== idx));
  const handleDocumentoChange = (idx: number, value: string) => {
    const next = [...documentos];
    next[idx] = value;
    setDocumentos(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hechos.trim() || !pretensiones.some(p => p.trim())) return;
    
    const input: DraftInput = {
      tipo,
      area: area === "auto" ? undefined : area,
      hechos:
        hechos.trim() +
        (antecedentes.trim() ? `\n\nNOTAS DEL CLIENTE:\n${antecedentes.trim()}` : ""),
      pretensiones: pretensiones.map(p => p.trim()).filter(Boolean),
      documentos: documentos.map(d => d.trim()).filter(Boolean),
      rol: rol.trim() || undefined,
      tribunal: tribunal.trim() || undefined,
    };
    await onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo de escrito */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de escrito</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(TIPO_LABELS).map(([key, { label, icon, desc }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTipo(key as DraftTipo)}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                tipo === key
                  ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-2 rounded-lg ${tipo === key ? "bg-blue-100" : "bg-slate-100"}`}>{icon}</span>
                <span className="font-bold text-slate-900">{label}</span>
              </div>
              <p className="text-[11px] text-slate-500">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Área legal */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">Área legal</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setArea("auto")}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
              area === "auto"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-slate-200 hover:border-emerald-300"
            }`}
          >
            <Brain className="w-4 h-4 inline mr-1" /> Auto-detectar
            {areaConfidence !== null && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                {Math.round(areaConfidence * 100)}%
              </span>
            )}
          </button>
          {Object.entries(AREA_LABELS).map(([key, { label, color }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setArea(key as DraftArea)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                area === key
                  ? `border-${color.split("-")[1]}-500 ${color} shadow-sm`
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hechos */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Hechos <span className="text-red-500">*</span>
          {tienePrefillDiagnostico && (
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 align-middle">
              Heredado del diagnóstico — edítalo libremente
            </span>
          )}
        </label>
        <textarea
          value={hechos}
          onChange={e => setHechos(e.target.value)}
          rows={6}
          placeholder="Relata los hechos cronológicamente. Ej: 'PRIMERO: Fui contratado el 15/03/2024... SEGUNDO: El 02/09/2026 fui despedido invocando art. 161... TERCERO: La empresa mantiene impagas cotizaciones de jun-jul-ago 2026...'"
          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none font-sans text-sm"
          required
        />
        <p className="text-[11px] text-slate-500 mt-1">Usa numeración ordinal (PRIMERO, SEGUNDO...) para que el validador verifique la estructura.</p>
      </div>

      {/* Antecedentes adicionales (nota del cliente, se fusiona al generar) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAntecedentes(!showAntecedentes)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Añadir / editar antecedentes adicionales (opcional)</span>
          {showAntecedentes ? <span className="text-xs text-slate-400">− contraer</span> : <span className="text-xs text-slate-400">+ expandir</span>}
        </button>
        {showAntecedentes && (
          <div className="mt-2 animate-slide-down">
            <textarea
              value={antecedentes}
              onChange={e => setAntecedentes(e.target.value)}
              rows={3}
              placeholder="Inyecta aquí notas o detalles específicos del caso que quieras agregar al borrador (fechas, montos, hechos omitidos, instrucciones para el redactor...). Se añadirán como 'NOTAS DEL CLIENTE' al final de los hechos."
              className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/50 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all resize-none text-sm"
            />
          </div>
        )}
      </div>

      {/* Pretensiones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">Pretensiones / Petitorio <span className="text-red-500">*</span></label>
          <button type="button" onClick={handleAddPretension} className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1">
            <span className="text-lg leading-none">+</span> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {pretensiones.map((p, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="mt-2 text-slate-400 font-mono text-sm">{idx + 1}.</span>
              <input
                type="text"
                value={p}
                onChange={e => handlePretensionChange(idx, e.target.value)}
                placeholder={idx === 0 ? "Ej: Declarar injustificado el despido" : "Ej: Condenar al pago de indemnización..."}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
              {pretensiones.length > 1 && (
                <button type="button" onClick={() => handleRemovePretension(idx)} className="mt-2 p-1 text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Documentos (opcional) */}
      <div>
        <button
          type="button"
          onClick={() => setShowDocumentos(!showDocumentos)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <FileText className={`w-4 h-4 transition-transform ${showDocumentos ? "rotate-90" : ""}`} />
          <span>Documentos anexos (opcional)</span>
        </button>
        {showDocumentos && (
          <div className="mt-3 space-y-2 animate-slide-down">
            {documentos.map((d, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="mt-2 text-slate-400 font-mono text-sm">{idx + 1}.</span>
                <textarea
                  value={d}
                  onChange={e => handleDocumentoChange(idx, e.target.value)}
                  placeholder="Texto del documento (carta despido, liquidación, certificado, etc.)"
                  rows={3}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm bg-slate-50"
                />
                {documentos.length > 1 && (
                  <button type="button" onClick={() => handleRemoveDocumento(idx)} className="mt-2 p-1 text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {documentos.length === 0 && (
              <button type="button" onClick={handleAddDocumento} className="w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Agregar primer documento
              </button>
            )}
            {documentos.length > 0 && (
              <button type="button" onClick={handleAddDocumento} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <span className="text-lg leading-none">+</span> Agregar otro
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadatos opcionales */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Rol de la causa (opcional)</label>
          <input
            type="text"
            value={rol}
            onChange={e => setRol(e.target.value)}
            placeholder="Ej: 12345-2024, RIT 456-2025"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Tribunal (opcional)</label>
          <input
            type="text"
            value={tribunal}
            onChange={e => setTribunal(e.target.value)}
            placeholder="Ej: 1° Juzgado de Letras del Trabajo de Santiago"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !hechos.trim() || !pretensiones.some(p => p.trim())}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-300 disabled:to-slate-400 text-white font-extrabold text-base rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generando borrador judicial...
          </>
        ) : (
          <>
            <Scale className="w-5 h-5" />
            Generar borrador técnico completo
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-slate-500">
        <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
        El borrador incluye trazabilidad automática (QA local) y nota discreta de revisión profesional.
      </p>
    </form>
  );
};