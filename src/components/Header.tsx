import React from 'react';
import { Shield, Calculator, FileText, Lock } from 'lucide-react';

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
            <a href="/" className="flex items-center gap-3 group" aria-label="LegalHelp Chile - Inicio">
              <svg className="transition-transform duration-200 group-hover:scale-105" width="30" height="34" viewBox="0 0 38 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 14px rgba(0,212,255,0.5))' }}>
                <defs>
                  <linearGradient id="lgNav" x1="0" y1="0" x2="38" y2="44" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00d4ff"></stop>
                    <stop offset="100%" stopColor="#60a5fa"></stop>
                  </linearGradient>
                </defs>
                <path d="M2 2 L13 2 L13 26 L36 26 L36 34 Q19 44 2 36 Z" fill="url(#lgNav)"></path>
                <rect x="14" y="2" width="5" height="24" fill="#05070f" rx="0.5"></rect>
                <rect x="27" y="2" width="5" height="24" fill="#05070f" rx="0.5"></rect>
                <rect x="14" y="11" width="18" height="5" fill="#05070f" rx="0.5"></rect>
              </svg>
              <span className="text-2xl font-bold tracking-tight" style={{ textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
                <span className="text-white">LEGAL</span>
                <span className="text-cyan-400" style={{ textShadow: '0 0 28px rgba(0,212,255,0.65), 0 0 60px rgba(0,212,255,0.25)' }}>HELP</span>
              </span>
            </a>
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-normal text-xs uppercase tracking-wider border-l border-slate-700 pl-2">
                  Diagnóstico Legal Chile
                </span>
                <span className="text-slate-500 font-normal text-[10px] uppercase tracking-wider border-l border-slate-700 pl-2">
                  Análisis de Expediente PJUD
                </span>
              </div>
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

