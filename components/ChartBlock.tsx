
import React from 'react';
import { FavoriteStar } from './MarketScreener';
import { ExchangeLogo } from './UI/Shared';
import { Rewind, X, BrainCircuit, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { CustomUndoIcon, CustomRedoIcon } from './MarketScreener';
import { Language } from '../src/translations';
import { MarketCoin } from '../models';

interface ChartBlockProps {
  previewCoin: MarketCoin | null;
  language: Language;
  t: any;
  isPortrait: boolean;
  isReplayMode: boolean;
  setIsReplayMode: (val: boolean) => void;
  setIsAiBookOpen: (val: boolean) => void;
  setAiBookCoin: (coin: MarketCoin) => void;
  timeframe: string;
  setTimeframe: (tf: string) => void;
  historyState: { canUndo: boolean; canRedo: boolean };
  miniChartRef: any;
  showExtraTf: boolean;
  setShowExtraTf: (val: boolean) => void;
  tfDropdownRef: React.RefObject<HTMLDivElement | null>;
  isFavorite: (coin: MarketCoin) => boolean;
  toggleFavorite: (e: React.MouseEvent, coin: MarketCoin) => void;
  isFullscreen: boolean;
  chartLayout: number;
  comparisonCoins: MarketCoin[];
  checkSubscription: (featureName: string) => boolean;
}

export const ChartBlock: React.FC<ChartBlockProps> = ({
  previewCoin,
  language,
  t,
  isPortrait,
  isReplayMode,
  setIsReplayMode,
  setIsAiBookOpen,
  setAiBookCoin,
  timeframe,
  setTimeframe,
  historyState,
  miniChartRef,
  showExtraTf,
  setShowExtraTf,
  tfDropdownRef,
  isFavorite,
  toggleFavorite,
  isFullscreen,
  chartLayout,
  comparisonCoins,
  checkSubscription
}) => {
  const MAIN_TIMEFRAMES = ['1m', '15m', '1h'];
  const EXTRA_TIMEFRAMES = [
    { label: language === 'ru' ? 'Минуты' : 'Minutes', items: ['1m', '3m', '5m', '15m', '30m'] },
    { label: language === 'ru' ? 'Часы' : 'Hours', items: ['1h', '2h', '4h', '6h', '12h'] },
    { label: language === 'ru' ? 'Дни / Недели' : 'Days / Weeks', items: ['1d', '1w'] }
  ];

  if (isFullscreen || chartLayout > 1) return null;

  return (
    <div className={`flex flex-col w-full transition-all duration-500 ${isFullscreen ? 'bg-[#0a0a0a]' : 'relative'}`}>
      {/* PLATFORM BLOCK HEADER */}
      <div className="h-[36px] md:h-[42px] bg-[#0d0d0d]/90 backdrop-blur-md flex items-center px-1.5 md:px-2 lg:px-3 gap-0 relative z-[3001]">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full gap-2 md:gap-3 lg:gap-4">
          {previewCoin ? (
            <>
              {/* ASSET INFO */}
              <div className="flex items-center gap-2 md:gap-3 lg:gap-4 pr-2 md:pr-3 lg:pr-4 border-r border-white/10 h-7 md:h-8 shrink-0">
                <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
                  <FavoriteStar 
                    coin={previewCoin} 
                    isInitialFavorite={isFavorite(previewCoin)} 
                    onToggle={toggleFavorite} 
                    size={14}
                  />
                  <div className="w-6 h-6 md:w-8 md:h-8 lg:w-8 lg:h-8 rounded-full border border-white/10 flex items-center justify-center p-0.5 md:p-1 bg-black shadow-[0_0_20px_rgba(0,0,0,0.8)] relative group">
                    <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img 
                      src={`/api/logos/${previewCoin.baseAsset.toUpperCase()}`} 
                      className="w-full h-full object-contain relative z-10" 
                      alt="" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-[10px] md:text-sm lg:text-sm font-black tracking-tighter text-white uppercase leading-none">
                        {previewCoin.symbol.includes('USDT') ? previewCoin.symbol.replace('USDT', ' / USDT') : `${previewCoin.symbol} / USDT`}
                      </span>
                      <span className={`text-[11px] md:text-[13px] font-black uppercase tracking-widest font-mono leading-none text-white pb-0.5 border-b ${previewCoin.market === 'SPOT' ? 'border-blue-600' : 'border-orange-500'}`}>
                        {previewCoin.market === 'SPOT' ? t.spot : t.futures}
                      </span>
                      <ExchangeLogo exchange={previewCoin.exchange} size="w-10 h-4 md:w-14 md:h-6 lg:w-14 lg:h-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* PRICE DISPLAY */}
              <div className="flex items-center px-2 md:px-3 lg:px-4 h-7 md:h-8 border-r border-white/10 shrink-0 gap-2 md:gap-3 lg:gap-4">
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] md:text-sm lg:text-sm font-mono font-black leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                    ${previewCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                </div>
                <div className="flex flex-col justify-center">
                  <span className={`text-[9px] md:text-[12px] lg:text-[12px] font-black font-mono leading-none flex items-center gap-0.5 md:gap-1 ${previewCoin.change24h >= 0 ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}>
                    <span className="opacity-50">{previewCoin.change24h >= 0 ? '▲' : '▼'}</span>
                    {previewCoin.change24h >= 0 ? '+' : ''}{previewCoin.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 px-4">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/5 animate-pulse" />
              <div className="h-4 w-24 md:w-32 bg-white/5 animate-pulse rounded-lg" />
              <div className="hidden md:block h-4 w-20 bg-white/5 animate-pulse rounded-lg" />
            </div>
          )}
        </div>

        {/* RIGHT SIDE CONTROLS */}
        <div className="flex items-center pl-2 md:pl-3 lg:pl-4 gap-2 md:gap-3 lg:gap-4 shrink-0 ml-auto relative z-[70]">
          {previewCoin && (
            <>
              {/* AI ANALYSIS BUTTON */}
              <div className="flex items-center h-7 md:h-8 shrink-0">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (checkSubscription('AI Analysis')) {
                      setAiBookCoin(previewCoin);
                      setIsAiBookOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1 rounded-xl border border-rose-500/30 bg-gradient-to-r from-purple-950/90 to-rose-900/90 hover:from-purple-900 hover:to-rose-800 transition-all group shadow-[0_0_15px_rgba(225,29,72,0.2)]"
                >
                  <BrainCircuit className="w-3 h-3 md:w-3.5 md:h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] md:text-[10px] font-black text-white/90 tracking-tighter uppercase whitespace-nowrap">
                    {t.ai_analysis}
                  </span>
                </button>
              </div>

              {/* ACTION BUTTONS (SIMULATOR) */}
              <div className="flex items-center shrink-0">
                <button 
                  onClick={() => {
                    if (checkSubscription('Simulator')) {
                      setIsReplayMode(!isReplayMode);
                    }
                  }}
                  className={`flex items-center gap-1 md:gap-1 lg:gap-1.5 px-1 md:px-1.5 xl:px-3 py-1 md:py-1.5 border rounded-xl text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 group relative overflow-hidden ${
                    isReplayMode 
                    ? 'bg-white border-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-105' 
                    : 'bg-[#1a1a1a] border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-[#222] shadow-lg'
                  }`}
                >
                  {isReplayMode ? (
                    <X size={14} strokeWidth={4} />
                  ) : (
                    <Rewind size={16} className="text-white group-hover:scale-110 transition-transform shrink-0" />
                  )}
                  <span className="hidden xl:inline">{isReplayMode ? 'ВЫЙТИ' : 'СИМУЛЯТОР'}</span>
                  <span className="hidden lg:inline xl:hidden text-[8px] tracking-tighter">{isReplayMode ? 'ВЫЙТИ' : 'СИМУЛЯТОР'}</span>
                  <span className="hidden md:inline lg:hidden text-[8px]">{isReplayMode ? 'ВЫЙТИ' : 'СИМ'}</span>
                  <span className="md:hidden">SIM</span>
                </button>
              </div>
            </>
          )}

          {/* UNDO/REDO - Desktop only */}
          <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => miniChartRef.current?.undo()}
              className={`w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg transition-all ${historyState.canUndo ? 'text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}
              disabled={!historyState.canUndo}
            >
              <CustomUndoIcon size={18} />
            </button>
            <button 
              onClick={() => miniChartRef.current?.redo()}
              className={`w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg transition-all ${historyState.canRedo ? 'text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}
              disabled={!historyState.canRedo}
            >
              <CustomRedoIcon size={18} />
            </button>
          </div>

          {/* TIMEFRAME SELECTOR - ONLY SHOW WHEN SINGLE CHART IS ACTIVE */}
          {chartLayout === 1 && comparisonCoins.length === 0 && (
            <div className="flex items-center bg-[#151515] p-0.5 md:p-1 rounded-xl border border-white/10 shadow-xl">
              {MAIN_TIMEFRAMES.map((tf) => (
                <button 
                  key={tf}
                  onClick={() => setTimeframe(tf)} 
                  className={`px-1.5 md:px-2 lg:px-2 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[11px] lg:text-[11px] font-black font-mono uppercase transition-all ${
                    timeframe === tf 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <div className="w-[1px] h-3 md:h-4 bg-white/10 mx-1 md:mx-1.5"></div>
              <div className="relative" ref={tfDropdownRef}>
                <button 
                  onClick={() => setShowExtraTf(!showExtraTf)}
                  className={`w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center transition-all ${
                    EXTRA_TIMEFRAMES.some(s => s.items.includes(timeframe)) && !MAIN_TIMEFRAMES.includes(timeframe)
                    ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <ChevronDown size={14} className={`transition-transform duration-300 ${showExtraTf ? 'rotate-180' : ''}`} />
                </button>
                
                {showExtraTf && (
                  <div className="absolute top-full right-0 mt-3 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] z-[3002] min-w-[220px] animate-in fade-in slide-in-from-top-3 duration-300 overflow-hidden ring-1 ring-white/5">
                    <div className="max-h-[70vh] overflow-y-auto no-scrollbar py-2">
                      {EXTRA_TIMEFRAMES.map((section, sIdx) => (
                        <div key={section.label} className={sIdx > 0 ? 'border-t border-white/5 mt-2 pt-2' : ''}>
                          <div className="px-4 py-1.5 flex items-center justify-between group cursor-default">
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{section.label}</span>
                            <ChevronUp size={10} className="text-gray-700" />
                          </div>
                          
                          <div className="flex flex-col px-2 gap-1">
                            {section.items.map(tf => {
                              const isActive = timeframe === tf;
                              return (
                                <button 
                                  key={tf} 
                                  onClick={() => {
                                    setTimeframe(tf);
                                    setShowExtraTf(false);
                                  }} 
                                  className={`w-full px-4 py-2.5 flex items-center justify-between transition-all group relative rounded-xl border ${
                                    isActive 
                                    ? 'bg-white/5 border-white/20 text-white' 
                                    : 'bg-transparent border-transparent text-white/40 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <span className={`text-[12px] font-bold font-mono uppercase ${isActive ? 'translate-x-1' : ''} transition-transform`}>
                                    {tf}
                                  </span>
                                  {isActive && <Check size={14} className="text-white" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
