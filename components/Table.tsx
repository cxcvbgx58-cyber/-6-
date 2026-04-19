
import React, { useState, useEffect, useMemo } from 'react';
import { RowData, OrderBookEntry, SettingsState, MarketType } from '../models';
import './QuantumCard.css';
import { BarChart3, Navigation, Type, ShieldCheck, Activity, BrainCircuit, Settings, RotateCcw, LayoutGrid, List, Volume2, BellRing } from 'lucide-react';
import { AIBookModal } from './AIBookModal';
import { ExchangeLogo } from './UI/Shared';
import { Language, translations } from '../src/translations';

const formatShortNumber = (num: number, language: Language): string => {
  if (isNaN(num) || num === 0) return '0.00';
  const t = translations[language];
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }) + ' ' + t.billion;
  if (num >= 1_000_000) return (num / 1_000_000).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }) + ' ' + t.million;
  if (num >= 1_000) return (num / 1_000).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 }) + t.thousand_k;
  return num.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 0 });
};

const CoinLogoMini = React.memo(({ symbol, size = "w-6 h-6" }: { symbol: string; size?: string }) => {
  const [error, setError] = useState(false);
  const base = symbol.replace('USDT', '').toUpperCase();
  const src = `/api/logos/${base}`;

  const getPlaceholderBg = (s: string) => {
    const colors = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-orange-600', 'bg-rose-600'];
    const index = s.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className={`${size} rounded-full bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative`}>
      {!error ? (
        <img 
          src={src} 
          alt="" 
          className="w-full h-full object-contain p-1" 
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        <div className={`qc-coin-placeholder-text w-full h-full flex items-center justify-center font-bold text-white ${getPlaceholderBg(base)}`}>
          {base.slice(0, 2)}
        </div>
      )}
    </div>
  );
});

const OrderBookMini: React.FC<{ depth: OrderBookEntry[]; isLong: boolean; language: Language }> = ({ depth, isLong, language }) => {
  if (!depth || depth.length === 0) return null;
  const t = translations[language];

  return (
    <div className="qc-ob-container">
      <div className="qc-ob-header flex items-center justify-between mb-1 px-1">
        <span className="qc-ob-header-text font-bold text-gray-500 tracking-[0.2em] uppercase">{t.order_book_slice}</span>
        <Activity size={8} className="text-purple-500 animate-pulse" />
      </div>
      
      <div className="qc-ob-list">
        {depth.map((level, idx) => (
          <div key={idx} className={`qc-ob-row ${level.isDensity ? 'qc-ob-density-row' : ''}`}>
            <div className="qc-ob-price">
              {level.price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </div>
            
            <div className="qc-ob-vol-container">
              <div 
                className="qc-ob-bar" 
                style={{ 
                  width: `${level.relativeSize * 100}%`,
                  backgroundColor: level.isDensity 
                    ? (isLong ? 'var(--hud-pos)' : 'var(--hud-neg)') 
                    : (isLong ? 'rgba(0, 255, 170, 0.2)' : 'rgba(255, 51, 85, 0.2)')
                }}
              />
              <span className="qc-ob-vol-text">{formatShortNumber(level.volume, language)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DensityCard = React.memo(({ data, isLong, onAnalyze, language, isBlurred }: { data: RowData; isLong: boolean; onAnalyze: (data: RowData) => void; language: Language; isBlurred?: boolean }) => {
  if (!data || !data.pair) return null;
  const t = translations[language];

  const priceVal = parseFloat(String(data.price));
  const reactionPriceVal = data.reactionPrice ? parseFloat(String(data.reactionPrice)) : priceVal;
  const reactionPriceStr = reactionPriceVal.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 10 
  });
  
  const pct = parseFloat(String(data.percentage || '0'));
  const pctStr = (pct > 0 ? '+' : '') + pct.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 4 
  }) + '%';
  
  const densityRaw = parseFloat(String(data.rawVolume || '0'));
  const density = formatShortNumber(densityRaw, language);
  
  const exchange = data.exchange || t.exchange;
  const exName = exchange.toLowerCase().includes('bybit') ? 'Bybit' : 'Binance';

  const statusColor = isLong ? 'var(--hud-pos)' : 'var(--hud-neg)';
  const statusLabel = isLong ? t.buy : t.sell;

  const rd = data.relDensity || 0;
  let rdColor = 'var(--hud-text)';
  if (rd >= 3.5) rdColor = 'var(--hud-pos)';
  if (rd >= 7.0) rdColor = '#a855f7'; 
  if (rd >= 12.0) rdColor = '#f59e0b'; 

  const isSpot = data.marketType === 'SPOT';
  const isTuned = data.isTuned; 

  return (
    <div className={`qc-hud-card h-full transition-all duration-300 ${isBlurred ? 'blur-md pointer-events-none' : ''}`}>
      <div className="qc-hud-scanline"></div>
      
      <div className="qc-hud-content">
        <div className="qc-hud-header">
           <div className="qc-hud-header-left">
              <div className="qc-hud-meta">
                  <span className="qc-hud-exchange">{exchange}</span>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <div className="flex items-center gap-2">
                      <ExchangeLogo exchange={exName} size="w-20 h-10" />
                      <div className="flex items-center gap-1.5">
                        <CoinLogoMini symbol={data.pair} size="w-6 h-6 sm:w-8 sm:h-8" />
                        <span className="qc-hud-pair leading-none text-white/70">{data.pair} / USDT</span>
                      </div>
                    </div>
                    
                    <div className="w-[1px] h-3 bg-white/20 mx-0.5" />

                    <div className={`qc-hud-market-type font-black uppercase tracking-widest font-mono leading-none text-white text-[13px] pb-0.5 border-b ${isSpot ? 'border-blue-600' : 'border-orange-500'}`}>
                      {isSpot ? t.spot : t.futures}
                    </div>
                  </div>
              </div>
           </div>
           
           <div className="qc-hud-status">
              <span className="qc-hud-status-text" style={{ color: statusColor }}>{statusLabel}</span>
              <div className="qc-hud-blinker" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}></div>
           </div>
        </div>

        <div className="flex gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div className="qc-hud-price-box flex-1">
             <div className="qc-hud-label-tiny uppercase font-bold tracking-widest">{t.density_price}</div>
             <div className="qc-hud-price-val text-white/70">
               {reactionPriceStr}
             </div>
          </div>
        </div>

        <div className="qc-hud-grid">
           <div className="qc-hud-metric-box">
              <div className="qc-metric-label">{t.volume}</div>
              <div className="qc-metric-value text-accent">${density}</div>
           </div>

           <div className="qc-hud-metric-box">
              <div className="qc-metric-label">RD (X)</div>
              <div className="qc-metric-value" style={{ color: rdColor }}>{rd.toFixed(1)}</div>
           </div>

           <div className="qc-hud-metric-box">
              <div className="qc-metric-label">{t.distance}</div>
              <div className="qc-metric-value" style={{ color: statusColor }}>
                 {pctStr}
              </div>
           </div>

        </div>

        <div className="qc-hud-ob-section">
           <OrderBookMini depth={data.depth || []} isLong={isLong} language={language} />
        </div>

        <div className="qc-hud-footer">
           <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
});

const DensityRow = React.memo(({ data, isLong, onAnalyze, language, isBlurred }: { data: RowData; isLong: boolean; onAnalyze: (data: RowData) => void; language: Language; isBlurred?: boolean }) => {
  if (!data || !data.pair) return null;
  const t = translations[language];

  const priceVal = parseFloat(String(data.price));
  const reactionPriceVal = data.reactionPrice ? parseFloat(String(data.reactionPrice)) : priceVal;
  const reactionPriceStr = reactionPriceVal.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 10 
  });
  
  const pct = parseFloat(String(data.percentage || '0'));
  const pctStr = (pct > 0 ? '+' : '') + pct.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 4 
  }) + '%';
  
  const densityRaw = parseFloat(String(data.rawVolume || '0'));
  const density = formatShortNumber(densityRaw, language);
  
  const exchange = data.exchange || t.exchange;
  const exName = exchange.toLowerCase().includes('bybit') ? 'Bybit' : 'Binance';

  const statusColor = isLong ? 'var(--hud-pos)' : 'var(--hud-neg)';
  const statusLabel = isLong ? t.buy : t.sell;

  const rd = data.relDensity || 0;
  let rdColor = 'var(--hud-text)';
  if (rd >= 3.5) rdColor = 'var(--hud-pos)';
  if (rd >= 7.0) rdColor = '#a855f7'; 
  if (rd >= 12.0) rdColor = '#f59e0b'; 

  const isSpot = data.marketType === 'SPOT';

  return (
    <div className={`qc-hud-card w-full py-2 px-4 flex items-center gap-4 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden ${isBlurred ? 'blur-md pointer-events-none' : ''}`}>
      <div className="qc-hud-scanline opacity-30"></div>
      
      <div className="flex items-center gap-3 min-w-[180px]">
        <ExchangeLogo exchange={exName} size="w-20 h-10" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <CoinLogoMini symbol={data.pair} size="w-7 h-7" />
            <span className="text-[11px] font-black text-white">{data.pair}/USDT</span>
          </div>
          <span className={`text-[13px] text-white font-mono tracking-widest uppercase pb-0.5 border-b ${isSpot ? 'border-blue-600' : 'border-orange-500'}`}>{isSpot ? t.spot : t.futures}</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 items-center">
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">{t.density_price}</span>
          <span className="text-[11px] font-mono text-white/90">{reactionPriceStr}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">{t.volume}</span>
          <span className="text-[11px] font-mono text-accent">${density}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">{t.distance}</span>
          <span className="text-[11px] font-mono" style={{ color: statusColor }}>{pctStr}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">RD (X)</span>
          <span className="text-[11px] font-mono" style={{ color: rdColor }}>{rd.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end min-w-[60px]">
          <span className="text-[9px] font-black" style={{ color: statusColor }}>{statusLabel}</span>
        </div>
      </div>
    </div>
  );
});

type SortMode = 'volume' | 'distance' | 'alphabet';

const SortButton: React.FC<{ 
  mode: SortMode, 
  currentMode: SortMode, 
  icon: any, 
  label: string, 
  onSelect: (m: SortMode) => void 
}> = ({ mode, currentMode, icon: Icon, label, onSelect }) => (
  <button 
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(mode);
    }}
    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl group pointer-events-auto cursor-pointer transition-all border ${
      currentMode === mode 
      ? 'bg-black/40 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
      : 'bg-black/20 border-white/5 hover:border-purple-500/30'
    }`}
  >
    <Icon size={12} className={currentMode === mode ? 'text-purple-500' : 'text-gray-500 group-hover:text-gray-300'} />
    <span className={`text-[10px] font-black uppercase tracking-widest ${
      currentMode === mode ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
    }`}>
      {label}
    </span>
    {currentMode === mode && (
      <div className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] rounded-full" />
    )}
  </button>
);

const DOMINATION_MAP: Record<number, number> = {
  1: 2.5,
  2: 3.5,
  3: 4.5,
  4: 5.5,
  5: 6.6
};

const getDominationSliderVal = (currentVal: string) => {
  const val = parseFloat(currentVal);
  if (val <= 2.5) return 1;
  if (val <= 3.5) return 2;
  if (val <= 4.5) return 3;
  if (val <= 5.5) return 4;
  return 5;
};

const Table: React.FC<{ 
  shortData: RowData[]; 
  longData: RowData[]; 
  language?: Language;
  onOpenAI?: (coin: any) => void;
  spotSettings: SettingsState;
  futuresSettings: SettingsState;
  onSettingChange: (type: MarketType, key: keyof SettingsState, val: any) => void;
  onResetSettings: (type: MarketType) => void;
  isBlurred?: boolean;
}> = ({ 
  shortData, 
  longData, 
  language = 'ru', 
  onOpenAI,
  spotSettings,
  futuresSettings,
  onSettingChange,
  onResetSettings,
  isBlurred = false
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('volume');
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = React.useRef<HTMLDivElement>(null);
  const t = translations[language];

  const settingLabels: Record<keyof SettingsState, string> = {
    volumeFilter: t.min_volume_usdt,
    minDensityVolume: t.min_volume_usdt,
    distancePercentage: t.max_dist_pct,
    peerMultiplier: t.domination_coeff,
    peerCount: t.analysis_orders_count,
    densityObserveTimeMs: t.observation_time_ms,
    degradationThreshold: t.degradation_threshold,
    soundAlertEnabled: t.sound_alert,
    soundAlertVolume: t.alert_volume,
    rdMissLimit: 'Лимит (не исп.)',
    activeCoin: 'Active Coin',
    timeframe: 'Timeframe',
    favorites: 'Favorites',
    drawings: 'Drawings',
    activeExchanges: 'Exchanges',
    activeTypes: 'Market Types',
    viewMode: 'View Mode',
    sortConfig: 'Sort Config',
    comparisonCoins: 'Comparison Coins',
    chartLayout: 'Chart Layout',
    selectedExchanges: 'Selected Exchanges',
    spotSettings: 'Spot Settings',
    futuresSettings: 'Futures Settings'
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setIsSettingsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedData = useMemo(() => {
    const combined = [...longData, ...shortData];
    
    return combined.sort((a, b) => {
      switch (sortMode) {
        case 'distance': {
          const valA = Math.abs(parseFloat(String(a.percentage || 0)));
          const valB = Math.abs(parseFloat(String(b.percentage || 0)));
          return valA - valB;
        }
        case 'alphabet': {
          const nameA = String(a.pair || '').toUpperCase();
          const nameB = String(b.pair || '').toUpperCase();
          return nameA.localeCompare(nameB);
        }
        case 'volume':
        default: {
          const valA = Number(a.rawVolume) || 0;
          const valB = Number(b.rawVolume) || 0;
          return valB - valA;
        }
      }
    });
  }, [shortData, longData, sortMode]);

  const handleAlarmToggle = (currentType: MarketType) => {
    const isEnabled = currentType === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled;
    const newValue = !isEnabled;

    if (newValue === true) {
      // Turn on both
      onSettingChange('SPOT', 'soundAlertEnabled', true);
      onSettingChange('FUTURES', 'soundAlertEnabled', true);
    } else {
      // Turn off only current
      onSettingChange(currentType, 'soundAlertEnabled', false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-[#0a0a0a] relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0a0a] backdrop-blur-xl shrink-0 z-[40] pointer-events-auto">
        <div className="flex items-center gap-2">
          <SortButton mode="volume" currentMode={sortMode} icon={BarChart3} label={t.volume} onSelect={setSortMode} />
          <SortButton mode="distance" currentMode={sortMode} icon={Navigation} label={t.distance} onSelect={setSortMode} />
          <SortButton mode="alphabet" currentMode={sortMode} icon={Type} label={t.asset} onSelect={setSortMode} />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-[9px] font-mono text-white uppercase tracking-widest">
            {t.monitoring} <span>{sortedData.length}</span>
          </div>

          <div className="relative" ref={settingsDropdownRef}>
            <button 
              onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)} 
              className={`p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 backdrop-blur-md transition-all group ${isSettingsDropdownOpen ? 'border-white/30 bg-white/20' : ''}`}
            >
              <Settings size={18} className={isSettingsDropdownOpen ? 'text-white' : 'text-white/40 group-hover:text-white transition-colors'} />
            </button>
            {isSettingsDropdownOpen && (
              <div className="absolute top-full right-0 mt-4 w-[calc(100vw-2rem)] sm:w-[820px] bg-[#0a0a0a] border border-white/10 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[100] p-6 sm:p-10 flex flex-col sm:flex-row gap-8 sm:gap-16 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden ring-1 ring-white/5">
                {(['SPOT', 'FUTURES'] as MarketType[]).map(type => (
                  <div key={type} className="flex-1 flex flex-col">
                    <div className="flex flex-col gap-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${type === 'SPOT' ? 'text-[#00ffa3] bg-[#00ffa3]' : 'text-[#ff9900] bg-[#ff9900]'}`} />
                          <div className="text-[13px] font-black uppercase tracking-[0.4em] text-white">
                            {type === 'SPOT' ? t.spot : t.futures}
                          </div>
                        </div>
                        <button 
                          onClick={() => onResetSettings(type)} 
                          className="text-white/20 hover:text-white transition-all hover:rotate-180 duration-500"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>

                      {/* Notification Block */}
                      <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        (type === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled)
                          ? 'bg-white border-white shadow-[0_20px_40px_rgba(255,255,255,0.15)] scale-[1.02]'
                          : 'bg-white/5 border-white/10'
                      }`}>
                        <div className="flex items-center gap-3">
                          <BellRing 
                            size={18} 
                            className={(type === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled) 
                              ? 'text-amber-400 animate-bounce' 
                              : 'text-white/30'} 
                          />
                          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                            (type === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled)
                              ? 'text-black'
                              : 'text-white/40'
                          }`}>
                            {t.density_notification}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleAlarmToggle(type)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${
                            (type === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled) 
                              ? 'bg-white ring-1 ring-black/5 shadow-inner' 
                              : 'bg-zinc-800 border border-white/5'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full transition-all duration-300 ${
                            (type === 'SPOT' ? spotSettings.soundAlertEnabled : futuresSettings.soundAlertEnabled) 
                              ? 'translate-x-[22px] bg-zinc-500 shadow-[0_2px_10px_rgba(0,0,0,0.1)]' 
                              : 'translate-x-1 bg-white/20'
                          }`} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-0">
                      <div className="flex items-center justify-between py-5 border-b border-white/5 group">
                        <div className="flex flex-col">
                          <label className="text-[11px] text-white uppercase font-bold tracking-wider group-hover:text-white/70 transition-colors">
                            {settingLabels.peerMultiplier}
                          </label>
                        </div>
                        <div className="flex flex-col items-end gap-1 w-40 sm:w-56">
                          <div className="relative w-full pt-4 pb-4">
                            <input 
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={getDominationSliderVal(type === 'SPOT' ? spotSettings.peerMultiplier : futuresSettings.peerMultiplier)}
                              onChange={(e) => {
                                const sliderVal = parseInt(e.target.value);
                                const mappedVal = DOMINATION_MAP[sliderVal];
                                onSettingChange(type, 'peerMultiplier', mappedVal.toString());
                              }}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer relative z-10
                                [&::-webkit-slider-thumb]:appearance-none 
                                [&::-webkit-slider-thumb]:w-4 
                                [&::-webkit-slider-thumb]:h-4 
                                [&::-webkit-slider-thumb]:rounded-full 
                                [&::-webkit-slider-thumb]:bg-black 
                                [&::-webkit-slider-thumb]:border-2 
                                [&::-webkit-slider-thumb]:border-zinc-500
                                hover:[&::-webkit-slider-thumb]:border-zinc-400
                                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.3)]
                                [&::-webkit-slider-thumb]:transition-all"
                            />
                            {/* Ticks & Numbers Above */}
                            <div className="absolute top-0 left-0 w-full pointer-events-none flex justify-between px-0.5">
                              {[1, 2, 3, 4, 5].map(v => (
                                <div key={v} className="flex flex-col items-center justify-end h-4">
                                  <span className={`text-[11px] mb-0.5 font-black transition-colors ${getDominationSliderVal(type === 'SPOT' ? spotSettings.peerMultiplier : futuresSettings.peerMultiplier) === v ? 'text-white' : 'text-white/20'}`}>
                                    {v}
                                  </span>
                                  <div className={`w-[1px] h-1 ${getDominationSliderVal(type === 'SPOT' ? spotSettings.peerMultiplier : futuresSettings.peerMultiplier) === v ? 'bg-purple-500' : 'bg-white/20'}`} />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="text-[10px] font-black uppercase text-white underline decoration-white/40 underline-offset-4 shadow-[0_0_10px_rgba(255,255,255,0.2)] text-right leading-none -mt-2">
                            {(() => {
                              const val = getDominationSliderVal(type === 'SPOT' ? spotSettings.peerMultiplier : futuresSettings.peerMultiplier);
                              return val === 1 ? t.density_weak :
                                     val === 2 ? t.density_medium :
                                     val === 3 ? t.density_normal :
                                     val === 4 ? t.density_good :
                                     t.density_strong;
                            })()}
                          </div>
                        </div>
                      </div>

                      {Object.keys(type === 'SPOT' ? spotSettings : futuresSettings)
                        .filter(k => ['minDensityVolume', 'distancePercentage'].includes(k))
                        .map((key, idx, arr) => {
                          const rawVal = type === 'SPOT' ? (spotSettings as any)[key] : (futuresSettings as any)[key];
                          // Formatting only for Volume fields (exclude percentage)
                          const displayVal = key === 'minDensityVolume'
                            ? rawVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') 
                            : rawVal;
                          
                          return (
                            <div key={key} className={`flex items-center justify-between py-5 ${idx !== arr.length - 1 ? 'border-b border-white/5' : ''} group`}>
                              <div className="flex flex-col">
                                <label className="text-[11px] text-white uppercase font-bold tracking-wider group-hover:text-white/70 transition-colors">
                                  {(settingLabels as any)[key]}
                                </label>
                              </div>
                              <input 
                                className="w-24 sm:w-36 bg-[#151515] border border-white/10 rounded-2xl text-[13px] px-4 py-2.5 text-right focus:border-white/30 focus:bg-[#1a1a1a] outline-none font-mono text-white transition-all shadow-inner" 
                                value={displayVal} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\s/g, '');
                                  onSettingChange(type, key as any, val);
                                }} 
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 z-[10] min-h-0">
        <div className="grid gap-6 lg:gap-8 pb-20 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mobile-landscape-2-col">
          {sortedData.map((row) => (
            <DensityCard 
              key={row.id} 
              data={row} 
              isLong={row.side === 'bid'} 
              onAnalyze={(data) => onOpenAI && onOpenAI(data)}
              language={language}
              isBlurred={isBlurred}
            />
          ))}
          {sortedData.length === 0 && (
            <div className="col-span-full h-[500px] flex flex-col items-center justify-center -mt-32 text-zinc-500/30 font-black text-[18px] sm:text-[24px] md:text-[32px] lg:text-[48px] text-center max-w-6xl mx-auto gap-8 lg:gap-12 px-6 lg:px-10">
               <div className="leading-[1.2] uppercase [word-spacing:0.3em] lg:[word-spacing:0.5em] tracking-tight relative whitespace-pre-line">
                 {t.searching_anomalies}
                 <BellRing className="inline-block ml-3 lg:ml-6 text-white -mt-1 lg:-mt-2 align-middle w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
               </div>
               <div className="w-10 h-10 lg:w-12 lg:h-12 border-2 border-white/5 border-t-purple-500/50 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>

      {/* REMOVED INTERNAL MODAL RENDERING - NOW HANDLED BY DASHBOARD */}
    </div>
  );
};

export default Table;
