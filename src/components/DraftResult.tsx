import React, { useState } from 'react';
import { DraftOutput, ValidacionLegalHelp } from '../types';
import { Copy, Download, AlertTriangle, CheckCircle2, Scale, FileText, ShieldCheck, AlertCircle, RotateCcw, Brain, MessageSquare } from 'lucide-react';

interface DraftResultProps {
  output: DraftOutput;
  onRegenerate: () => void;
  onNewDraft: () => void;
}

const cleanMdText = (text: string): string =>
  text
    .replace(/\*\*/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[`_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export const DraftResult: React.FC<DraftResultProps> = ({ output, onRegenerate, onNewDraft }) => {
  const [copied, setCopied] = useState(false);
  const [showValidation, setShowValidation] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseSections = (markdown: string) => {
    if (!markdown) return [];
    if (markdown.includes('## ')) {
      const rawChunks = markdown.split('## ').filter(c => c.trim().length > 0);
      const sections = [];
      let leadText = '';
      for (const chunk of rawChunks) {
        const trimmed = chunk.trim();
        const lines = trimmed.split('\n');
        const headerLine = lines[0].trim();
        const isHeader = /^(\d+[\.\)]|estructura|hechos|derecho|petitorio|otros[ií]|fundamentos|trazabilidad)/i.test(headerLine);
        if (!isHeader && sections.length === 0) {
          leadText = trimmed;
        } else {
          const title = headerLine.replace(/^#+\s*/, '');
          let body = lines.slice(1).join('\n').trim();
          if (!body) body = trimmed;
          if (leadText) { body = leadText + '\n\n' + body; leadText = ''; }
          sections.push({ title, body });
        }
      }
      if (sections.length > 0) return sections;
    }
    const lines = markdown.trim().split('\n');
    return [{ title: lines[0]?.replace(/^#+\s*/, '') || 'Escrito', body: lines.slice(1).join('\n').trim() || markdown }];
  };

  const sections = parseSections(output.draft);
  const validacion = output.validacion;

  const getValidationIcon = (key: keyof ValidacionLegalHelp) => {
    const val = validacion[key];
    if (typeof val === 'boolean') return val ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />;
    if (Array.isArray(val)) return val.length > 0 ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Borrador Generado</h2>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className={`px-2 py-0.5 rounded font-bold uppercase border ${
                output.metadatos.area === 'laboral' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                output.metadatos.area === 'civil' ? 'bg-green-100 text-green-800 border-green-200' :
                output.metadatos.area === 'familia' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                output.metadatos.area === 'penal' ? 'bg-red-100 text-red-800 border-red-200' :
                output.metadatos.area === 'administrativo' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {output.metadatos.area}
              </span>
              <span className="px-2 py-0.5 rounded font-bold uppercase border bg-slate-100 text-slate-700 border-slate-200">
                {output.metadatos.tipo}
              </span>
              <span className="px-2 py-0.5 rounded font-bold uppercase border bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> QA OK
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopy}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
              copied ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>{copied ? '¡Copiado!' : 'Copiar al portapapeles'}</span>
          </button>
          <button
            onClick={onRegenerate}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Regenerar</span>
          </button>
          <button
            onClick={onNewDraft}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Nuevo escrito</span>
          </button>
        </div>
      </div>

      {/* Documento principal */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm printable-area text-slate-800 leading-relaxed max-w-none">
        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>ESCRITO PROCESAL CHILE • LEGALHELP IA • {new Date().toLocaleDateString('es-CL')}</span>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded flex items-center gap-1">
            <Brain className="w-3 h-3" /> BORRADOR OPERATIVO SUJETO A REVISIÓN PROFESIONAL
          </span>
        </div>

        <div className="max-w-none space-y-6">
          {sections.map((sec, idx) => {
            const { title, body } = sec;
            let icon = <Scale className="w-5 h-5 text-blue-600" />;
            let borderClass = 'border-l-4 border-blue-600 bg-slate-50 text-slate-900';
            let titleClass = 'text-slate-900';

            if (/hechos|antecedentes/i.test(title)) {
              icon = <FileText className="w-5 h-5 text-blue-600" />;
              borderClass = 'border-l-4 border-blue-600 bg-blue-50/50';
            } else if (/derecho|fundamentos/i.test(title)) {
              icon = <Scale className="w-5 h-5 text-blue-700" />;
              borderClass = 'border-l-4 border-slate-400 bg-slate-50';
            } else if (/petitorio|solicito|por tanto/i.test(title)) {
              icon = <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
              borderClass = 'border-l-4 border-red-600 bg-red-50 text-red-950 font-medium';
              titleClass = 'text-red-900';
            } else if (/otros[ií]/i.test(title)) {
              icon = <MessageSquare className="w-5 h-5 text-orange-600 shrink-0" />;
              borderClass = 'border-l-4 border-orange-500 bg-orange-50 text-orange-950';
              titleClass = 'text-orange-900';
            } else if (/trazabilidad|blindaje|verificaci/i.test(title)) {
              icon = <ShieldCheck className="w-5 h-5 text-slate-700" />;
              borderClass = 'border-l-4 border-slate-500 bg-slate-50/70';
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
        </div>
      </div>

      {/* Panel de Trazabilidad (Validación LegalHelp) */}
      {showValidation && validacion && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-slate-700" />
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Trazabilidad Automática del Escrito</h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded border border-slate-300">
                QA local · sin IA
              </span>
            </div>
            <button
              onClick={() => setShowValidation(!showValidation)}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Ocultar
            </button>
          </div>

          {/* Resumen grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-xs">
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Estructura</div>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                {validacion.estructuraJudicial ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>COMPLETA</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>INCOMPLETA</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Numeración</div>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                {validacion.numeracionHechosValida ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>VÁLIDA</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>REVISAR</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Petitorio</div>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                {validacion.petitorioValido ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>VÁLIDO</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>INCOMPLETO</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Art. clave</div>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                {validacion.articulosClaveFaltantes.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>OK</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{validacion.articulosClaveFaltantes.length} faltantes</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detalle BCN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Roles</div>
              <div className="font-bold text-slate-900">
                {validacion.rolesEnCorpus.length} verificados
                {validacion.rolesNoEnCorpus.length > 0 && (
                  <span className="text-red-700"> · {validacion.rolesNoEnCorpus.length} fuera</span>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Artículos BCN</div>
              <div className="font-bold text-slate-900">
                {validacion.artsCubiertos.length} con texto
                {validacion.artsSinCobertura.length > 0 && (
                  <span className="text-amber-700"> · {validacion.artsSinCobertura.length} sin cobertura</span>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Montos</div>
              <div className="font-bold text-slate-900">
                {validacion.montosInforme} citados
                {validacion.montosNoCorroborados.length > 0 && (
                  <span className="text-amber-700"> · {validacion.montosNoCorroborados.length} no corroborados</span>
                )}
              </div>
            </div>
          </div>

          {/* Alertas específicas */}
          {validacion.rolesNoEnCorpus.length > 0 && (
            <div className="mb-3 text-[11px] text-red-800 bg-red-50 border border-red-200 rounded p-2">
              <span className="font-bold">Roles NO VERIFICADOS:</span> {validacion.rolesNoEnCorpus.slice(0, 4).join(', ')}
              {validacion.rolesNoEnCorpus.length > 4 && ` +${validacion.rolesNoEnCorpus.length - 4} más`}
              — Confírmalos en el buscador del PJUD antes de citarlos.
            </div>
          )}
          {validacion.artsSinCobertura.length > 0 && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-bold">Artículos sin texto BCN:</span> {validacion.artsSinCobertura.slice(0, 4).join(', ')}
              — Verifícalos en www.leychile.cl.
            </div>
          )}
          {validacion.articulosClaveFaltantes.length > 0 && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-bold">Artículos clave del área no detectados:</span> {validacion.articulosClaveFaltantes.join(', ')}
              — Considera incluirlos si son aplicables al caso.
            </div>
          )}
          {validacion.montosNoCorroborados.length > 0 && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-bold">Montos no corroborados:</span> {validacion.montosNoCorroborados.slice(0, 3).map(m => `$${m}`).join(', ')}
              — Revisa los cálculos contra el documento original.
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            Contraste determinista sobre el texto final con corpus Open Legal + Ley Chile BCN. Ayuda a detectar errores del modelo, no reemplaza criterio profesional.
          </p>
        </div>
      )}

      {/* BCN Verificados */}
      {output.bcn.citados.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <CheckCircle2 className="w-5 h-5 text-indigo-700" />
            <h3 className="text-lg font-bold tracking-tight text-indigo-950">Textos oficiales verificados (Ley Chile — BCN)</h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
              {output.bcn.citados.length} artículos
            </span>
          </div>
          <ul className="space-y-2 text-xs">
            {output.bcn.citados.slice(0, 10).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-indigo-600"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                <span className="flex-1">
                  <span className="font-bold text-indigo-950">{a.nombreNorma}</span>{' '}
                  Art. <span className="font-bold text-indigo-950">{a.articulo}</span>
                  {a.fechaVersion && <span className="text-slate-500"> · versión {a.fechaVersion}</span>}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:underline text-[10px]">
                      Ver en Ley Chile
                    </a>
                  )}
                </span>
                {a.vigente && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                    Vigente
                  </span>
                )}
              </li>
            ))}
            {output.bcn.citados.length > 10 && (
              <li className="text-slate-500 text-center py-2">+{output.bcn.citados.length - 10} artículos más...</li>
            )}
          </ul>
        </div>
      )}

      {/* Jurisprudencia / Casos referenciados (del metadatos) */}
      {(output.bcn.pendientes.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            <h3 className="text-lg font-bold tracking-tight text-amber-950">Cuerpos normativos sin verificación BCN</h3>
          </div>
          <ul className="space-y-1 text-xs text-amber-800">
            {output.bcn.pendientes.slice(0, 6).map((p, i) => (
              <li key={i} className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-bold">{p.nombreNorma}</span> (arts. {p.articulosPedidos.join(', ')}) — {p.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-[11px] text-slate-500 mt-4">
        <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-600" />
        Borrador con trazabilidad completa — Listo para revisión profesional y presentación
      </p>
    </div>
  );
};