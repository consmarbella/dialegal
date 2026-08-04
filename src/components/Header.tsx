import React from 'react';
import { Shield, Scale, Calculator, FileText, Lock } from 'lucide-react';

interface HeaderProps {
  activeTab: 'analyzer' | 'calculator';
  setActiveTab: (tab: 'analyzer' | 'calculator') => void;
  hasAntecedents?: boolean;
  isPaid?: boolean;
  onOpenPayment?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasAntecedents = false,
  isPaid = false,
}) => {
  const isCalculatorBlinking = hasAntecedents && !isPaid;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-lg shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Diagnóstico Legal Chile
                  <span className="text-slate-400 font-normal text-xs uppercase tracking-wider border-l border-slate-700 pl-2">
                    Análisis de Expediente PJUD
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Diagnóstico Procesal Inmediato: Traduce tu Demanda, Calcula tus Plazos Finales y Evalúa tu Demanda
              </p>
            </div>
          </div>

          {/* Quick Info Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded border border-slate-700/60 text-xs text-slate-300">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Verificación de Plazos Finales y Jurisprudencia Chilena</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-slate-800/80 pt-2 pb-2">
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'analyzer'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Diagnóstico de Caso</span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-4 py-2 text-xs rounded-lg transition-all whitespace-nowrap relative cursor-pointer ${
              isCalculatorBlinking
                ? 'bg-amber-400 text-slate-950 font-black animate-pulse ring-2 ring-amber-300 shadow-lg shadow-amber-400/30'
                : activeTab === 'calculator'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800 font-semibold'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Calculadora de Plazos Finales</span>
            {isCalculatorBlinking && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
              </span>
            )}
            {!isPaid && (
              <Lock className={`w-3.5 h-3.5 ${isCalculatorBlinking ? 'text-slate-950' : 'text-amber-400'} ml-0.5`} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

