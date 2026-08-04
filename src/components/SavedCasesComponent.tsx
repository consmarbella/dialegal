import React from 'react';
import { SavedAnalysis } from '../types';
import { BookmarkCheck, Trash2, Eye, Calendar, Scale, ChevronRight } from 'lucide-react';

interface SavedCasesProps {
  savedCases: SavedAnalysis[];
  onSelectCase: (saved: SavedAnalysis) => void;
  onDeleteCase: (id: string) => void;
  onClearAll: () => void;
}

export const SavedCasesComponent: React.FC<SavedCasesProps> = ({
  savedCases,
  onSelectCase,
  onDeleteCase,
  onClearAll,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold shrink-0">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historial de Diagnósticos Guardados</h2>
            <p className="text-xs text-slate-500">
              Guarda y consulta tus informes procesales sin perder la información.
            </p>
          </div>
        </div>

        {savedCases.length > 0 && (
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>Borrar Historial</span>
          </button>
        )}
      </div>

      {/* Saved Cases List */}
      {savedCases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 space-y-3 shadow-sm">
          <Scale className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-900">No tienes diagnósticos guardados en tu historial</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cuando generes un diagnóstico legal con el Asistente Litigante IA, haz clic en el botón "Guardar" para conservarlo aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedCases.map((saved) => (
            <div
              key={saved.id}
              className="bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-5 shadow-sm space-y-3 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                    {saved.area}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {saved.date}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{saved.title}</h3>

                <p className="text-xs text-slate-700 line-clamp-3 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed italic">
                  "{saved.userStory}"
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectCase(saved)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Informe Completo</span>
                </button>

                <button
                  onClick={() => onDeleteCase(saved.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-all"
                  title="Eliminar de mi historial"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
