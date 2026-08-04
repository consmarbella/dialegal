import React, { useState } from 'react';
import { GLOSSARY_TERMS } from '../data/chileanLegalData';
import { BookOpen, Search, Filter, ChevronRight, HelpCircle, Scale } from 'lucide-react';

export const GlossaryComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const filteredTerms = GLOSSARY_TERMS.filter((item) => {
    const matchesSearch =
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.practicalImpact.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'todos' ||
      item.area.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Diccionario y Traductor de "Leguleyo" Chileno</h2>
            <p className="text-xs text-slate-500">
              Traducción en español simple de la jerga procesal usada en los Tribunales de Chile y la Oficina Judicial Virtual (OJV).
            </p>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar término (ej: traslado, embargo...)"
              className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          >
            <option value="todos">Todas las materias</option>
            <option value="civil">Civil y Cobranza</option>
            <option value="laboral">Laboral</option>
            <option value="familia">Familia</option>
            <option value="procesal">Procesal General</option>
          </select>
        </div>
      </div>

      {/* Term Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTerms.length === 0 ? (
          <div className="col-span-2 bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-xs shadow-sm">
            No se encontraron términos para la búsqueda "{searchTerm}". Intenta con otra palabra.
          </div>
        ) : (
          filteredTerms.map((term) => (
            <div
              key={term.id}
              className="bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-5 shadow-sm space-y-3 transition-all"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  {term.term}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {term.area}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Definición Legal:
                </span>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{term.definition}</p>
              </div>

              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-lg">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  ¿Qué significa esto para ti?:
                </span>
                <p className="text-xs text-blue-950 mt-1 leading-relaxed font-medium">
                  {term.practicalImpact}
                </p>
              </div>

              {term.exampleInPjud && (
                <div className="text-[11px] text-slate-700 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-amber-800 font-sans font-bold">Ejemplo en PJUD:</span>{' '}
                  {term.exampleInPjud}
                </div>
              )}

              {term.codeReference && (
                <p className="text-[10px] text-slate-400 italic text-right">
                  Fuente: {term.codeReference}
                </p>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
