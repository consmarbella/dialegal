import React, { useState } from 'react';
import { DOC_TYPES, DocType } from '../lib/constants';
import { FileText, Download, Loader2, Wand2, Copy, CheckCircle2, ArrowLeft } from 'lucide-react';

interface DocumentGeneratorProps {
  caseData: {
    nombre?: string;
    rut?: string;
    tribunal?: string;
    rol?: string;
    materia?: string;
    demandante?: string;
    demandado?: string;
    area?: string;
    [key: string]: unknown;
  };
}

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ caseData }) => {
  const [selectedDoc, setSelectedDoc] = useState<DocType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setIsGenerating(true);
    setError(null);
    setIsQuotaError(false);
    setGeneratedDoc(null);

    try {
      const response = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedDoc.template,
          caseData,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || 'Error generando el documento');
        if (response.status === 429) setIsQuotaError(true);
        return;
      }

      setGeneratedDoc(data.document);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'md' | 'txt') => {
    if (!generatedDoc || !selectedDoc) return;

    const safeName = selectedDoc.label.replace(/\s+/g, '_').toLowerCase();

    fetch('/api/download-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: generatedDoc,
        filename: safeName,
        format,
      }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Wand2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Generador de Documentos Legales</h3>
          <p className="text-xs text-slate-500">Redacta escritos judiciales listos para presentar en el PJUD</p>
        </div>
      </div>

      {!generatedDoc ? (
        <>
          {/* Doc Type Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOC_TYPES.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedDoc?.id === doc.id
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{doc.label}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.description}</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
                    {doc.price}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-2">
              <p>{error}</p>
              {isQuotaError && (
                <a
                  href="https://wa.me/56967658939"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Atender por WhatsApp ahora
                </a>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedDoc || isGenerating}
            className={`w-full py-3.5 px-6 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-3 transition-all shadow-sm ${
              !selectedDoc || isGenerating
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Redactando {selectedDoc?.label}...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>{selectedDoc ? `Generar ${selectedDoc.label}` : 'Selecciona un tipo de documento'}</span>
              </>
            )}
          </button>
        </>
      ) : (
        <>
          {/* Generated Document Display */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setGeneratedDoc(null);
                    setSelectedDoc(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Nuevo documento</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => handleDownload('md')}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .md</span>
                </button>
                <button
                  onClick={() => handleDownload('txt')}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.txt</span>
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="p-6 max-h-[600px] overflow-y-auto">
              <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                {generatedDoc}
              </pre>
            </div>
          </div>

          {/* Success Banner */}
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Documento generado exitosamente</p>
              <p className="text-xs text-emerald-700">
                Revisa el contenido y descárgalo. Recuerda que debe ser revisado y firmado por un abogado habilitado.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
