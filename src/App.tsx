import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CaseAnalyzer } from './components/CaseAnalyzer';
import { AnalysisReport } from './components/AnalysisReport';
import { DeadlineCalculatorComponent } from './components/DeadlineCalculatorComponent';
import { PaymentModal } from './components/PaymentModal';
import { LegalArea, SavedAnalysis } from './types';
import { Scale } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'calculator'>('analyzer');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    markdown: string;
    userStory: string;
    area: LegalArea;
    notificationDate?: string;
    isPaid?: boolean;
  } | null>(null);

  const [savedCases, setSavedCases] = useState<SavedAnalysis[]>([]);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

  // Load saved cases from localStorage & handle MercadoPago redirect back
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pjud_legal_diagnoses');
      if (stored) {
        setSavedCases(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading saved cases:', e);
    }

    // Check MercadoPago redirect back URL params
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('orderId');

    if (paymentStatus === 'success' || orderId) {
      if (orderId) {
        fetch(`/api/payment/status?orderId=${orderId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.status === 'approved') {
              setAnalysisResult((prev) => (prev ? { ...prev, isPaid: true } : null));
            }
          })
          .catch(console.error);
      } else if (paymentStatus === 'success') {
        setAnalysisResult((prev) => (prev ? { ...prev, isPaid: true } : null));
      }
    }
  }, []);

  // Save to localStorage helper
  const saveCasesToStorage = (cases: SavedAnalysis[]) => {
    setSavedCases(cases);
    try {
      localStorage.setItem('pjud_legal_diagnoses', JSON.stringify(cases));
    } catch (e) {
      console.error('Error saving cases:', e);
    }
  };

  const handleAnalyze = async (payload: {
    userStory: string;
    documentText: string;
    area: LegalArea;
    files: { mimeType: string; data: string; name: string }[];
    notificationDate: string;
  }) => {
    setIsLoading(true);
    setAnalysisResult(null);
    setCurrentSavedId(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        alert(data.error || 'Ocurrió un problema al generar el diagnóstico legal.');
        return;
      }

      setAnalysisResult({
        markdown: data.analysis,
        userStory: payload.userStory || 'Análisis de documento legal adjunto',
        area: payload.area,
        notificationDate: payload.notificationDate,
        isPaid: false,
      });

      // Auto scroll to top of report
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error en análisis:', err);
      alert('Error conectando con el servidor de análisis legal: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrentReport = () => {
    if (!analysisResult) return;

    const newId = Date.now().toString();
    const newSaved: SavedAnalysis = {
      id: newId,
      date: new Date().toLocaleDateString('es-CL'),
      title: `Diagnóstico ${analysisResult.area.toUpperCase()} - ${new Date().toLocaleDateString('es-CL')}`,
      area: analysisResult.area,
      userStory: analysisResult.userStory,
      analysisMarkdown: analysisResult.markdown,
      notificationDate: analysisResult.notificationDate,
      isPaid: analysisResult.isPaid || false,
    };

    const updated = [newSaved, ...savedCases];
    saveCasesToStorage(updated);
    setCurrentSavedId(newId);
  };

  const hasAntecedents = analysisResult !== null;
  const isPaid = analysisResult?.isPaid || false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAntecedents={hasAntecedents}
        isPaid={isPaid}
        onOpenPayment={() => setIsPaymentModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {activeTab === 'analyzer' && (
          <div className="space-y-6">
            {analysisResult ? (
              <AnalysisReport
                analysisMarkdown={analysisResult.markdown}
                userStory={analysisResult.userStory}
                area={analysisResult.area}
                notificationDate={analysisResult.notificationDate}
                onSaveToHistory={handleSaveCurrentReport}
                isSaved={currentSavedId !== null}
                onNewAnalysis={() => setAnalysisResult(null)}
                isPaidInitial={analysisResult.isPaid}
                onPaymentSuccess={() =>
                  setAnalysisResult((prev) => (prev ? { ...prev, isPaid: true } : null))
                }
              />
            ) : (
              <CaseAnalyzer onAnalyze={handleAnalyze} isLoading={isLoading} />
            )}
          </div>
        )}

        {activeTab === 'calculator' && (
          <DeadlineCalculatorComponent
            isUnlocked={isPaid}
            onOpenPayment={() => setIsPaymentModalOpen(true)}
          />
        )}

      </main>

      {/* Global Payment Modal if opened from Calculator or Header */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          setAnalysisResult((prev) => (prev ? { ...prev, isPaid: true } : null));
          setIsPaymentModalOpen(false);
        }}
        areaLabel={analysisResult?.area.toUpperCase() || 'CIVIL'}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-slate-500 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-700">Diagnóstico Legal Chile • PJUD & OJV</span>
          </div>
          <p className="text-[11px] text-center sm:text-right text-slate-500 max-w-xl">
            Este software es una herramienta de orientación legal adaptada a la legislación chilena (CPC, Código del Trabajo, Ley 19.968). No constituye asesoría ni reemplaza el patrocinio de un abogado habilitado para el ejercicio de la profesión en Chile.
          </p>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/56967658939?text=Hola%20LegalHelp%2C%20necesito%20orientaci%C3%B3n%20legal"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#1fb855] hover:scale-110 transition-all"
      >
        <svg width="28" height="28" fill="#fff" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>

    </div>
  );
}

