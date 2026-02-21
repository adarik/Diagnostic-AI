/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Stethoscope, 
  History, 
  Info,
  X,
  Loader2,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeInfectionImage, AnalysisResult } from './services/geminiService';
import { cn } from './utils/cn';
import Markdown from 'react-markdown';

interface ScanHistoryItem extends AnalysisResult {
  id: string;
  timestamp: number;
  image: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      setError("Не удалось получить доступ к камере. Проверьте разрешения.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
        setResult(null);
      }
    }
  };

  const runAnalysis = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const analysis = await analyzeInfectionImage(image, 'image/jpeg');
      setResult(analysis);
      
      const historyItem: ScanHistoryItem = {
        ...analysis,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        image: image
      };
      setHistory(prev => [historyItem, ...prev]);
    } catch (err) {
      setError("Ошибка при анализе изображения. Пожалуйста, попробуйте еще раз.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency: AnalysisResult['urgency']) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const translateUrgency = (urgency: AnalysisResult['urgency']) => {
    switch (urgency) {
      case 'critical': return 'Критический';
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return urgency;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Stethoscope className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">InfectoScan AI</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Помощник диагноста v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative"
              title="История"
            >
              <History className="w-5 h-5 text-slate-600" />
              {history.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold">Система активна</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Preview */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                Ввод данных
              </h2>
              {image && (
                <button 
                  onClick={() => { setImage(null); setResult(null); }}
                  className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Сбросить
                </button>
              )}
            </div>

            <div className="p-6">
              {!image && !isCameraOpen ? (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl p-10 transition-all duration-200 flex flex-col items-center justify-center gap-4"
                  >
                    <div className="w-14 h-14 bg-slate-50 group-hover:bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-colors">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">Загрузить фото</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG до 10MB</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-medium">или</span></div>
                  </div>

                  <button 
                    onClick={startCamera}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Camera className="w-4 h-4" />
                    Использовать камеру
                  </button>
                </div>
              ) : isCameraOpen ? (
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-inner">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={capturePhoto}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-100 transition-all"
                    >
                      Сделать снимок
                    </button>
                    <button 
                      onClick={stopCamera}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition-all"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <img src={image!} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className={cn(
                      "w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3",
                      isAnalyzing 
                        ? "bg-slate-400 cursor-not-allowed" 
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]"
                    )}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Анализирую...
                      </>
                    ) : (
                      <>
                        <Activity className="w-5 h-5" />
                        Начать диагностику
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-amber-800 font-medium">
              <p className="font-bold mb-1 uppercase tracking-wider">Медицинский отказ от ответственности</p>
              Данная система является вспомогательным инструментом на базе ИИ. Результаты не являются окончательным диагнозом. Окончательное клиническое решение принимает врач-инфекционист на основе комплексного обследования.
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-4 mb-6"
              >
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-700">Ошибка анализа</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </motion.div>
            )}

            {result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Main Diagnosis Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className={cn(
                    "px-6 py-4 border-b flex items-center justify-between",
                    getUrgencyColor(result.urgency)
                  )}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Уровень срочности: {translateUrgency(result.urgency)}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-70 uppercase tracking-tighter">ID: {Math.random().toString(36).substr(2, 6)}</span>
                  </div>
                  
                  <div className="p-8">
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Предполагаемый диагноз</h3>
                    <h2 className="text-3xl font-bold text-slate-900 leading-tight mb-6">{result.diagnosis}</h2>
                    
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-indigo-500" />
                          Клиническое обоснование
                        </h4>
                        <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed">
                          <Markdown>{result.reasoning}</Markdown>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-indigo-500" />
                            Диф. диагноз
                          </h4>
                          <ul className="space-y-2">
                            {result.differentialDiagnosis.map((item, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Рекомендации
                          </h4>
                          <ul className="space-y-2">
                            {result.recommendations.map((item, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5"></div>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : !isAnalyzing && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-12"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Stethoscope className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Ожидание данных</h3>
                <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                  Загрузите клиническое фото или сделайте снимок для начала автоматизированного анализа.
                </p>
              </motion.div>
            )}

            {isAnalyzing && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[400px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="relative mb-8">
                  <div className="w-24 h-24 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 w-24 h-24 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Глубокий визуальный анализ</h3>
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 animate-pulse">Сопоставление с базой инфекционных патологий...</p>
                  <p className="text-xs text-slate-400">Это может занять до 15 секунд</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* History Sidebar Overlay */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  История сканирований
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
                    <Clock className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">История пуста</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setResult(item);
                        setImage(item.image);
                        setShowHistory(false);
                      }}
                      className="group cursor-pointer bg-slate-50 hover:bg-white hover:shadow-md border border-slate-100 rounded-xl p-4 transition-all"
                    >
                      <div className="flex gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                          <img src={item.image} className="w-full h-full object-cover" alt="History" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              getUrgencyColor(item.urgency)
                            )}>
                              {translateUrgency(item.urgency)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{item.diagnosis}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.reasoning}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setHistory([])}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  Очистить историю
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-40 grayscale">
            <Stethoscope className="w-5 h-5" />
            <span className="text-sm font-bold tracking-tighter">INFECTOSCAN AI</span>
          </div>
          <div className="flex gap-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-indigo-600 transition-colors">Протоколы</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Конфиденциальность</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Документация</a>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            © 2026 Medical Intelligence Systems. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  );
}
