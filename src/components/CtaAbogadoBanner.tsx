import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface CtaAbogadoBannerProps {
  onClick: () => void;
}

export const CtaAbogadoBanner: React.FC<CtaAbogadoBannerProps> = ({ onClick }) => {
  return (
    <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-7 shadow-[0_0_40px_rgba(37,99,235,0.25)]">
      {/* Alerta de plazo fatal */}
      <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-4 sm:mb-5">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs sm:text-sm font-extrabold text-red-300 uppercase tracking-wide">
            Alerta de Plazo Fatal
          </p>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Sin patrocinio de un abogado habilitado, los escritos que presentes en la OJV serán
            tenidos por no presentados y puedes perder el plazo para contestar.
          </p>
        </div>
      </div>

      {/* CTA principal */}
      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-[64px] px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400 text-white font-extrabold text-base sm:text-xl leading-snug text-center shadow-[0_0_28px_rgba(59,130,246,0.55)] hover:shadow-[0_0_46px_rgba(59,130,246,0.9)] hover:scale-[1.02] active:scale-100 transition-all duration-200 cursor-pointer border border-white/20"
      >
        ⚖️ Cotizar y Conectar con un Abogado Especialista Ahora
      </button>

      {/* Subtexto de urgencia */}
      <p className="text-[11px] sm:text-xs text-amber-300 text-center mt-3 font-bold leading-relaxed">
        Por Ley 18.120 necesitas patrocinio para contestar a tiempo en la OJV. Revisa opciones en
        minutos.
      </p>
    </div>
  );
};
