import React from 'react';
import { Building2, KeyRound, Search, FileDown, ShieldCheck, ExternalLink, HelpCircle, AlertCircle } from 'lucide-react';

export const OjvGuideComponent: React.FC = () => {
  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Guía Oficial de Uso de OJV y Poder Judicial (PJUD)</h2>
            <p className="text-xs text-slate-500">
              Paso a paso para revisar tus causas, descargar resoluciones y obtener ayuda legal en Chile.
            </p>
          </div>
        </div>

        <a
          href="https://ojv.pjud.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-all flex items-center gap-2 shrink-0 shadow-sm"
        >
          <span>Ir a OJV Oficial (ojv.pjud.cl)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Step by Step Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Step 1 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Ingreso con ClaveÚnica
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Ingresa al portal <strong className="text-blue-800">ojv.pjud.cl</strong> o <strong className="text-blue-800">tramitefacil.pjud.cl</strong>. Haz clic en "Iniciar Sesión" y autentícate con tu RUT y ClaveÚnica otorgada por el Registro Civil.
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700">
            💡 <em>Tip:</em> Si eres parte en un juicio (demandante o demandado), la causa aparecerá vinculada automáticamente a tu Rut en la pestaña "Mis Causas".
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Ubicación por RIT / ROL y Tribunal
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            En la sección "Consulta Unificada de Causas", selecciona la materia (Civil, Laboral, Familia, Penal) e ingresa el número de RIT o ROL (ej: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-900 font-mono font-bold">C-1234-2025</code>) y el Tribunal respectivo.
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700">
            📌 <strong>RIT vs ROL:</strong> RIT es el Rol Interno del Tribunal de primera instancia. ROL es la identificación asignada en Cortes de Apelaciones o Corte Suprema.
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileDown className="w-4 h-4 text-emerald-600" />
              Revisión de Cuadernos y PDF
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Al desplegar la causa, verás la lista cronológica de resoluciones y escritos.
            Ten presente que algunas causas (como ejecuciones o medidas precautorias) tienen dos pestañas:
          </p>
          <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
            <li><strong>Cuaderno Principal:</strong> Donde se tramita la demanda y contestación.</li>
            <li><strong>Cuaderno de Apremio / Medidas:</strong> Donde figuran los mandamientos de embargo, búsquedas y citaciones.</li>
          </ul>
        </div>

        {/* Step 4 */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
              4
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Asistencia Legal Gratuita en Chile
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Si no cuentas con recursos para contratar un abogado privado, la ley chilena garantiza representación gratuita a través de:
          </p>
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <strong>Corporación de Asistencia Judicial (CAJ):</strong> Orientación y patrocinio judicial gratuito en causas civiles, laborales y de familia (cajmetro.cl / cajval.cl).
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <strong>Defensoría Penal Pública (DPP):</strong> Defensa técnica gratuita si estás citado o imputado en causa penal (dpp.cl).
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <strong>Clínicas Jurídicas Universitarias:</strong> Atención en facultades de derecho acreditadas en Chile.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
