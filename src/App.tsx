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

    </div>
  );
}

