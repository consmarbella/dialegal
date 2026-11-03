import React, { useState, useRef, useEffect } from 'react';
import { LegalArea, Audience } from '../types';
import { Upload, X, FileText, AlertTriangle, Calendar, HelpCircle, CheckCircle2, FileSearch, Shield, Scale, User, Briefcase } from 'lucide-react';

interface CaseAnalyzerProps {
  onAnalyze: (payload: {
    userStory: string;
    documentText: string;
    /** Fase D.2: opcional. Sin área, la plataforma decide la materia con las
     *  señales del texto + el corpus. El formulario principal NO declara área. */
    area?: LegalArea;
    files: { mimeType: string; data: string; name: string }[];
    notificationDate: string;
    /** Producto dual: persona (B2C) vs abogado (B2B). */
    audience: Audience;
  }) => void;
  isLoading: boolean;
}

export const CaseAnalyzer: React.FC<CaseAnalyzerProps> = ({ onAnalyze, isLoading }) => {
  const [audience, setAudience] = useState<Audience | null>(() => {
    try {
      const saved = localStorage.getItem('legalhelp_audience');
      if (saved === 'persona' || saved === 'abogado') return saved;
    } catch { /* incógnito */ }
    return null;
  });
  const [userStory, setUserStory] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [notificationDate, setNotificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachedFiles, setAttachedFiles] = useState<{ mimeType: string; data: string; name: string; previewUrl?: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!audience) return;
    try { localStorage.setItem('legalhelp_audience', audience); } catch { /* incógnito */ }
  }, [audience]);

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const fileName = file.name.toLowerCase();
      const isPlainTxt = file.type === 'text/plain' || fileName.endsWith('.txt');

      if (isPlainTxt) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setDocumentText((prev) => (prev ? `${prev}\n\n--- ${file.name} ---\n${text}` : text));
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1] || result;

          let mime = file.type;
          if (!mime) {
            if (fileName.endsWith('.docx')) {
              mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            } else if (fileName.endsWith('.doc')) {
              mime = 'application/msword';
            } else if (fileName.endsWith('.pdf')) {
              mime = 'application/pdf';
            } else if (fileName.endsWith('.txt')) {
              mime = 'text/plain';
            } else {
              mime = 'application/octet-stream';
            }
          }

          setAttachedFiles((prev) => [
            ...prev,
            {
              mimeType: mime,
              data: base64Data,
              name: file.name,
              previewUrl: file.type.startsWith('image/') ? result : undefined,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audience) {
      alert('Elige primero si eres persona/pyme o abogado. Son productos distintos.');
      return;
    }
    if (!userStory.trim() && !documentText.trim() && attachedFiles.length === 0) {
      alert('Por favor ingresa tu relato, pega el texto de la demanda/resolución o adjunta una fotografía/documento legal.');
      return;
    }
    onAnalyze({
      userStory,
      documentText,
      // Fase D.2: no se declara área; la plataforma la decide con el texto.
      files: attachedFiles.map(({ mimeType, data, name }) => ({ mimeType, data, name })),
      notificationDate,
      audience,
    });
  };

  // Gate de producto: persona vs abogado (obligatorio antes del formulario)
  if (!audience) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center">
            ¿Quién va a usar LegalHelp?
          </h2>
          <p className="mt-2 text-center text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
            Son dos productos distintos. Elige tu perfil: cambia el lenguaje, la profundidad y lo que te entregamos.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setAudience('persona')}
              className="group text-left rounded-xl border-2 border-slate-200 hover:border-blue-600 hover:bg-blue-50/50 p-5 transition focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-slate-900">Persona / Pyme</div>
                  <div className="text-xs text-slate-500">Ciudadano, dueño de negocio</div>
                </div>
              </div>
              <ul className="mt-3 text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>Lenguaje claro, sin jerga</li>
                <li>Semáforo de urgencia y plata en juego</li>
                <li>Qué hacer en las próximas 24 horas</li>
              </ul>
            </button>
            <button
              type="button"
              onClick={() => setAudience('abogado')}
              className="group text-left rounded-xl border-2 border-slate-200 hover:border-slate-800 hover:bg-slate-50 p-5 transition focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-slate-900">Abogado / Estudio</div>
                  <div className="text-xs text-slate-500">Litigante, profesional del derecho</div>
                </div>
              </div>
              <ul className="mt-3 text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>Excepciones, checklist procesal</li>
                <li>Citas y línea estratégica</li>
                <li>Borradores de escritos listos para revisar</li>
              </ul>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Perfil activo + cambio */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-slate-700">
          {audience === 'persona' ? <User className="h-4 w-4 text-blue-600" /> : <Briefcase className="h-4 w-4 text-slate-800" />}
          <span>
            Perfil: <strong>{audience === 'persona' ? 'Persona / Pyme' : 'Abogado / Estudio'}</strong>
            <span className="text-slate-500"> — {audience === 'persona' ? 'diagnóstico en chileno claro' : 'análisis táctico de litigio'}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAudience(null)}
          className="text-blue-700 hover:underline text-xs font-medium"
        >
          Cambiar perfil
        </button>
      </div>

      {/* High-Converting 2-Card Hero Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Left Card: Defense against Lawsuits */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-900/60 shadow-xl text-center px-5 py-8 sm:py-10 sm:px-8 text-white bg-slate-950 flex flex-col justify-between">
          {/* Blurred Background Image */}
          <img
            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80"
            alt="Sala de tribunales"
            referrerPolicy="no-referrer"
            className="absolute inset-0 object-cover w-full h-full filter blur-[4px] scale-105 opacity-20 pointer-events-none"
          />

          {/* Deep Blue Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-blue-950/90 to-slate-950 pointer-events-none" />

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center h-full justify-between">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-md shadow-xs">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Protección legal inmediata</span>
              </div>

              {/* Pain Question */}
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                ¿Te notificaron una demanda?
              </h2>

              {/* Urgency Promise (Yellow Text) */}
              <p className="text-lg sm:text-xl font-black text-amber-400 mt-2.5 tracking-tight uppercase drop-shadow-sm">
                Defiéndete ahora
              </p>

              {/* 1-Line Benefit */}
              <p className="text-xs sm:text-sm text-slate-300 mt-3 max-w-sm mx-auto leading-relaxed font-medium">
                En 2 minutos sabes cuánto tiempo tienes, qué riesgos corres y qué hacer HOY.
              </p>
            </div>

            <div className="w-full mt-6">
              {/* Call to Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <FileSearch className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Diagnosticar mi caso</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    formRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => fileInputRef.current?.click(), 300);
                  }}
                  className="w-full sm:w-auto flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Subir documento o foto</span>
                </button>
              </div>

              {/* Trust Bar */}
              <div className="border-t border-white/15 mt-6 pt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">⏱️</span> Plazos finales
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">🚨</span> Riesgo patrimonial
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">📄</span> Traduce tu demanda
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">⚡</span> En minutos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Filing a Lawsuit */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-900/60 shadow-xl text-center px-5 py-8 sm:py-10 sm:px-8 text-white bg-slate-950 flex flex-col justify-between">
          {/* Blurred Background Image */}
          <img
            src="https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80"
            alt="Estudio jurídico"
            referrerPolicy="no-referrer"
            className="absolute inset-0 object-cover w-full h-full filter blur-[4px] scale-105 opacity-20 pointer-events-none"
          />

          {/* Deep Indigo/Blue Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-indigo-950/90 to-slate-950 pointer-events-none" />

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center h-full justify-between">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-md shadow-xs">
                <Scale className="w-4 h-4 text-indigo-400" />
                <span>Evaluación de acción legal</span>
              </div>

              {/* Question */}
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                ¿Necesitas demandar?
              </h2>

              {/* Yellow Highlight Text */}
              <p className="text-lg sm:text-xl font-black text-amber-400 mt-2.5 tracking-tight uppercase drop-shadow-sm">
                ANALIZAMOS TU CASO
              </p>

              {/* 1-Line Benefit */}
              <p className="text-xs sm:text-sm text-slate-300 mt-3 max-w-sm mx-auto leading-relaxed font-medium">
                Evaluamos si tienes fundamentos legales para demandar, la viabilidad de tu reclamo y los pasos a seguir.
              </p>
            </div>

            <div className="w-full mt-6">
              {/* Call to Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 hover:shadow-indigo-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <FileSearch className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Evaluar mi demanda</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    formRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => fileInputRef.current?.click(), 300);
                  }}
                  className="w-full sm:w-auto flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Subir antecedentes</span>
                </button>
              </div>

              {/* Trust Bar */}
              <div className="border-t border-white/15 mt-6 pt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">⚖️</span> Viabilidad legal
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">📋</span> Requisitos
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">🎯</span> Estrategia clara
                </span>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">⚡</span> En minutos
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Main Intake Form */}
      <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Notification Date */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Fecha de Notificación / Recepción del Documento
          </label>
          <input
            type="date"
            value={notificationDate}
            onChange={(e) => setNotificationDate(e.target.value)}
            className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Día exacto en que te entregaron el documento o fuiste notificado.
          </p>
        </div>

        {/* Step 1: User Story */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            1. Tu Relato del Problema
          </label>
          <textarea
            value={userStory}
            onChange={(e) => setUserStory(e.target.value)}
            rows={4}
            placeholder="Explica con tus propias palabras qué sucedió (ej: 'Hoy me entregaron unos papeles de demanda del banco', 'Me despidieron sin pagar indemnización', 'Me citaron a declarar en fiscalía por una denuncia')..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white leading-relaxed"
          />
        </div>

        {/* Step 2: Document Text OR Upload File */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Documento Legal (Resolución, Demanda, Citación, Finiquito)
            </label>
            <span className="text-xs text-slate-500">Puedes pegar el texto O subir una foto/archivo</span>
          </div>

          <textarea
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            rows={5}
            placeholder="Pega aquí el texto copiado de la OJV, PDF o resolución del tribunal (ej: 'SANTIAGO, 12 de Julio... Despáchese mandamiento de ejecución y embargo...')."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white leading-relaxed"
          />

          {/* File Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && processFiles(e.target.files)}
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-slate-700">
                Haz clic o arrastra tus documentos legales: Word (.docx, .doc), PDF, Fotos o TXT
              </p>
              <p className="text-[11px] text-slate-500">
                Formatos permitidos: Word (.docx/.doc), PDF, JPG, PNG, TXT, ODT. La IA extraerá y analizará todo el contenido.
              </p>
            </div>
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="relative group bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center gap-2 overflow-hidden"
                >
                  {file.previewUrl ? (
                    <img src={file.previewUrl} alt={file.name} className="w-10 h-10 object-cover rounded border border-slate-200" />
                  ) : (
                    <FileText className="w-8 h-8 text-blue-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500">Adjuntado para OCR</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2 space-y-2">
          <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
            <span>La materia (civil, laboral, familia…) la decide la plataforma con tu relato y el corpus legal; no tienes que elegirla.</span>
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 px-6 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-3 transition-all shadow-sm ${
              isLoading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analizando Expediente y Cruzando Leyes Chilenas (CPC, C. del Trabajo)...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-5 h-5" />
                <span>Generar Diagnóstico Legal con IA Senior</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
