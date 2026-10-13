import React, { useState } from 'react';
import { X, Lock, ShieldCheck, CheckCircle2, MessageCircle, ArrowRight } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  areaLabel: string;
}

const WHATSAPP_NUMBER = '56967658939';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  areaLabel,
}) => {
  const [adminCode, setAdminCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAdminBypass = (code: string) => {
    setAdminCode(code);
    if (code === atob('NDMyMQ==')) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
          setIsSuccess(false);
        }, 1000);
      }, 800);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hola, solicito el link de pago para desbloquear mi Dictamen Técnico Legal Completo (${areaLabel}) por $19.990 CLP.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Desbloqueo de Diagnóstico</h3>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30">
                  Respuesta inmediata
                </span>
              </div>
              <p className="text-xs text-slate-300">Diagnóstico Legal Completo ({areaLabel})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Admin Code / Bypass Option */}
          {!isSuccess && !isProcessing && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <span className="text-base">🧪</span>
                <span>Código Administrador:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  maxLength={6}
                  value={adminCode}
                  onChange={(e) => handleAdminBypass(e.target.value)}
                  placeholder="Código"
                  className="w-24 bg-white border border-amber-300 rounded px-2.5 py-1 text-center font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-slate-900">¡Pago Aprobado Exitosamente!</h4>
                <p className="text-xs text-slate-600 mt-1">Transacción #TARJETA-{Math.floor(100000 + Math.random() * 900000)} Confirmada</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-900 font-semibold max-w-sm mx-auto">
                Desbloqueando tu Dictamen Técnico Completo y Plan de Acción...
              </div>
            </div>
          ) : isProcessing ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Validando código...</h4>
                <p className="text-xs text-slate-500 mt-1">Desbloqueando tu dictamen legal.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Servicio Legal • Pago Único</span>
                  <p className="text-sm font-bold text-slate-900">Dictamen Técnico Completo & Plazos Fatales</p>
                  <p className="text-xs text-slate-500 mt-0.5">Desbloquea todos los puntos del análisis + Chat con Abogado IA</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">$19.990</span>
                  <span className="text-xs text-slate-500 font-bold block">CLP</span>
                </div>
              </div>

              {/* Payment Method Banner */}
              <div className="border border-green-200 bg-green-50/80 rounded-lg p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-extrabold text-green-900 block">Link de pago por WhatsApp</span>
                  <span className="text-[11px] text-green-700 font-medium">Te enviamos un link seguro de pago (Débito, Crédito o transferencia) al instante</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Security Guarantee */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Te enviamos el link oficial de pago. Tras confirmar el pago, tu dictamen se desbloquea al instante.</span>
                </div>

                {/* WhatsApp CTA */}
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Solicitar link de pago al WhatsApp ($19.990 CLP)</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
