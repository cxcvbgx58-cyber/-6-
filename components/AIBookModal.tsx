import React, { useState, useEffect, useCallback } from 'react';
import { X, Zap, BookOpen, ShieldCheck, TrendingUp, TrendingDown, Minus, ExternalLink, Info, Globe, RotateCcw } from 'lucide-react';
import { AIIcon } from './UI/Icons';
import { AIService, AIInsightResponse } from '../services/ai.service';
import { Language, translations } from '../src/translations';
import { MarketCoin } from './MarketScreener';
import { RowData } from '../models';

interface AIBookModalProps {
  coin: MarketCoin | RowData;
  onClose: () => void;
  language: Language;
}

export const AIBookModal: React.FC<AIBookModalProps> = ({ coin, onClose, language }) => {
  const [data, setData] = useState<AIInsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const t = translations[language];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setProgress(0);
      // 20 seconds = 20000ms. Update every 500ms -> 40 updates.
      // 98 / 40 = 2.45 per update.
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const increment = 1.5 + Math.random() * 2; // Average ~2.5
          return Math.min(prev + increment, 98);
        });
      }, 500);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const assetData: RowData = {
    id: 'ai-temp',
    pair: (coin as MarketCoin).symbol || (coin as RowData).pair,
    price: String((coin as MarketCoin).price || (coin as RowData).price),
    exchange: (coin as MarketCoin).exchange || (coin as RowData).exchange,
    marketType: (coin as MarketCoin).market || (coin as RowData).marketType,
    side: 'bid',
    percentage: '0',
    rawVolume: 0,
    relDensity: 0,
    isTuned: false
  };

  const fetchAnalysis = useCallback(async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await AIService.analyzeAsset(assetData, language, 'gemini-3-flash-preview');
      
      // If data is empty and we haven't retried yet, try one more time
      if (!isRetry && (!result.why || result.why.length === 0)) {
        console.log("AI data empty, retrying...");
        const retryResult = await AIService.analyzeAsset(assetData, language, 'gemini-3-flash-preview');
        setData(retryResult);
      } else {
        setData(result);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      setError(t.error_generation);
    } finally {
      setLoading(false);
    }
  }, [coin, language]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-full sm:h-[750px] max-h-[95vh] sm:max-h-[90vh] bg-[#0a0a0a] border border-purple-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_80px_rgba(139,92,246,0.2)] flex flex-col overflow-hidden relative">
        <div className="qc-hud-scanline opacity-10" />
        
        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 pb-8 custom-scroll relative z-10">
          {/* PERMANENT TOP HEADER (Always visible) */}
          <div className="mb-6 sm:mb-8 animate-in slide-in-from-top duration-700">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* LIGHTNING BLOCK */}
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#1A1025] rounded-xl sm:rounded-2xl border border-purple-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.1)] shrink-0">
                <Zap size={20} className="sm:w-7 sm:h-7 text-purple-400" />
              </div>
              
              {/* INTEGRATED TITLE BLOCK */}
              <div className="flex-1 bg-[#0A0A0A]/60 border border-white/5 p-3 sm:p-5 rounded-2xl sm:rounded-[30px] backdrop-blur-md relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-sm sm:text-xl font-black tracking-tight text-white uppercase leading-tight flex flex-wrap items-center gap-x-2">
                    <span>{t.deep_intel}</span>
                    <span className="text-white">{assetData.pair.includes('USDT') ? assetData.pair.replace('USDT', ' / USDT') : `${assetData.pair} / USDT`}</span>
                  </h2>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 sm:gap-8">
              <div className="flex gap-1.5 sm:gap-2">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 sm:w-1.5 h-1 sm:h-1.5 border border-zinc-500 rounded-full animate-bounce" 
                    style={{ animationDelay: `${i * 0.15}s` }} 
                  />
                ))}
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-3">
                  <p className="text-[10px] sm:text-sm font-black text-white uppercase tracking-[0.3em] sm:tracking-[0.4em] animate-pulse">
                    {t.analyzing}
                  </p>
                  <span className="text-xs sm:text-sm font-mono text-white font-bold">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
              <Zap className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />
              <p className="text-[10px] sm:text-sm font-black text-red-400 uppercase tracking-widest">{error}</p>
              <button onClick={() => fetchAnalysis()} className="px-6 sm:px-8 py-2.5 sm:py-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all">
                {t.retry}
              </button>
            </div>
          ) : data && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
              <div className="bg-purple-500/5 border border-purple-500/20 p-4 sm:p-8 rounded-2xl sm:rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="text-[9px] sm:text-[10px] text-white font-black uppercase tracking-widest">
                      CoinMarketCap AI: {t.why_label}
                    </span>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {data?.why && data.why.length > 0 ? (
                      data.why.map((w, i) => (
                        <div key={i} className="flex items-start gap-2.5 sm:gap-3 bg-white/[0.02] p-2.5 sm:p-3 rounded-xl border border-white/5">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-purple-400 shrink-0 border border-purple-500/30">
                            {i + 1}
                          </div>
                          <span className="text-xs sm:text-sm text-zinc-300 font-medium leading-relaxed">{w}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center gap-3 sm:gap-4 py-3 sm:py-4">
                        <p className="text-[10px] sm:text-xs text-zinc-500 italic">No brief data found.</p>
                        <button 
                          onClick={() => fetchAnalysis()}
                          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all"
                        >
                          <RotateCcw size={10} className="sm:w-3 sm:h-3 text-purple-400" />
                          {t.retry}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DATA GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                {data?.metrics && Object.entries(data.metrics)
                  .filter(([key]) => !['protocol', 'news', 'protocolTitle'].includes(key))
                  .map(([key, val]) => {
                    if (!val) return null;
                    const cmcSource = data.sources?.find(s => s.uri.includes('coinmarketcap.com'));
                    const isClickable = (key === 'cap' || key === 'volume' || key === 'rank') && cmcSource;

                    return (
                      <div 
                        key={key} 
                        className={`bg-purple-500/5 border border-purple-500/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl relative overflow-hidden transition-all group ${isClickable ? 'cursor-pointer' : ''}`}
                        onClick={() => isClickable && window.open(cmcSource.uri, '_blank')}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                            <span className="text-[7px] sm:text-[8px] text-zinc-500 font-black uppercase tracking-wider group-hover:text-purple-400 transition-colors">
                              {t[key as keyof typeof t] || key}
                            </span>
                            {isClickable && <ExternalLink size={8} className="text-purple-500/50" />}
                          </div>
                          <p className="text-zinc-300 text-[10px] sm:text-[11px] font-mono truncate" title={String(val)}>
                            {val}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* PROTOCOL SECTION */}
              {data.metrics.protocol && (
                <div className="bg-purple-500/5 border border-purple-500/20 p-4 sm:p-6 rounded-xl sm:rounded-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <BookOpen size={14} className="sm:w-4 sm:h-4 text-purple-400" />
                    <span className="text-[9px] sm:text-[10px] text-white font-black uppercase tracking-widest">
                      {data.metrics.protocolTitle || t.protocol}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {data.metrics.protocol}
                  </p>
                </div>
              )}

              {/* SOURCES */}
              <div className="bg-purple-500/5 border border-purple-500/20 p-4 sm:p-6 rounded-xl sm:rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-2 mb-3 sm:mb-4 relative z-10">
                  <Globe size={14} className="sm:w-4 sm:h-4 text-purple-400" />
                  <span className="text-[9px] sm:text-[10px] text-white font-black uppercase tracking-widest">{t.sources}</span>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 relative z-10">
                  {data.sources.map((s, i) => (
                    <a 
                      key={i} 
                      href={s.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-black/40 border border-white/10 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold text-zinc-400 hover:text-white hover:border-purple-500/50 transition-all group"
                    >
                      <span className="max-w-[120px] sm:max-w-[150px] truncate">{s.title}</span>
                      <ExternalLink size={8} className="sm:w-2.5 sm:h-2.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-8 py-3 sm:py-4 border-t border-white/5 bg-black/60 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] text-zinc-600 font-black uppercase tracking-widest">
            <BookOpen size={12} className="sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">SmartEye Intelligence Core v4.5A</span>
            <span className="xs:hidden">SmartEye Core</span>
          </div>
          <button onClick={onClose} className="px-5 sm:px-8 py-2 sm:py-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white hover:bg-purple-500/20 transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)]">
            {t.close_report}
          </button>
        </div>
      </div>
    </div>
  );
};
