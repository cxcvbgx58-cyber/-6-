
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  AlertTriangle, ChevronDown, ChevronUp, Check, Loader2, RefreshCw, 
  MousePointer2, Ruler, Magnet, Brush, Trash2, Circle as CircleIcon, BarChart2,
  Play, Pause, FastForward, Rewind, X, ChevronRight
} from 'lucide-react';
import { Language, translations } from '../../src/translations';
import { MarketType } from '../../models';
import { CustomChartEngine, Candle, Drawing } from './CustomChartEngine';
import { TradingSimulatorService } from '../../services/trading-simulator.service';
import { CustomUndoIcon, CustomRedoIcon } from '../MarketScreener';

export interface MiniChartProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange?: (tf: string) => void;
  isLong: boolean;
  price: number | string;
  currentPrice?: number | string;
  onOpen?: () => void;
  isExpanded?: boolean;
  marketType: MarketType;
  exchange?: string;
  children?: React.ReactNode; 
  height?: number; 
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  isReplayMode?: boolean;
  setIsReplayMode?: (val: boolean) => void;
  isPlaying?: boolean;
  setIsPlaying?: (val: boolean) => void;
  replaySpeed?: number;
  setReplaySpeed?: (val: number) => void;
  alerts?: {id: string, symbol: string, price: number, type: 'above' | 'below'}[];
  onAlertChange?: (alert: {id: string, symbol: string, price: number, type: 'above' | 'below'}) => void;
  positions?: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    liquidationPrice: number;
    takeProfit?: number;
    stopLoss?: number;
    amount: number;
    leverage: number;
  }[];
  pendingOrders?: {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    limitPrice: number;
    amount: number;
    leverage: number;
  }[];
  language?: Language;
  isAdditional?: boolean;
  activeTool?: Drawing['type'] | 'ruler' | null;
  onToolChange?: (tool: Drawing['type'] | 'ruler' | null) => void;
  magnetEnabled?: boolean;
  onMagnetChange?: (enabled: boolean) => void;
  drawings?: Drawing[];
  onDrawingsChange?: (drawings: Drawing[]) => void;
}

let globalRequestIndex = 0;

const CustomCrosshairIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrendLineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="4" y1="20" x2="20" y2="4" />
    <circle cx="8" cy="16" r="2.5" fill="#080808" />
    <circle cx="16" cy="8" r="2.5" fill="#080808" />
  </svg>
);

const RayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="3" y1="21" x2="23" y2="1" />
    <circle cx="7" cy="17" r="2.5" fill="#080808" />
    <circle cx="14" cy="10" r="2.5" fill="#080808" />
  </svg>
);

const HLineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="1" y1="12" x2="23" y2="12" />
    <circle cx="12" cy="12" r="2.5" fill="#080808" />
  </svg>
);

const HRayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="6" y1="12" x2="23" y2="12" />
    <circle cx="6" cy="12" r="2.5" fill="#080808" />
  </svg>
);

const VLineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="2" x2="12" y2="22" />
    <circle cx="12" cy="12" r="2.5" fill="#080808" />
  </svg>
);

const CrossLineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="2.5" fill="#080808" />
  </svg>
);

const RectangleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const MAIN_TIMEFRAMES = ['1m', '15m', '1h'];
const EXTRA_TIMEFRAMES = ['3m', '5m', '30m', '2h', '4h', '6h', '12h', '1d', '1w'];

export const MiniChart = React.memo(forwardRef<any, MiniChartProps>(({ 
  symbol, timeframe, onTimeframeChange, isLong, price, currentPrice, onOpen, isExpanded, 
  marketType, exchange, children, height, onHistoryChange, isReplayMode = false, setIsReplayMode, 
  isPlaying: propsIsPlaying, setIsPlaying: propsSetIsPlaying, replaySpeed: propsReplaySpeed, 
  setReplaySpeed: propsSetReplaySpeed, alerts = [], onAlertChange, positions = [], 
  pendingOrders = [], language = 'ru', isAdditional = false,
  activeTool: propsActiveTool, onToolChange, magnetEnabled: propsMagnetEnabled, onMagnetChange,
  drawings: propsDrawings, onDrawingsChange
}, ref) => {
  const t = translations[language];
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  
  const [internalActiveTool, setInternalActiveTool] = useState<Drawing['type'] | 'ruler' | null>(null);
  const activeTool = propsActiveTool !== undefined ? propsActiveTool : internalActiveTool;
  const setActiveTool = useCallback((tool: Drawing['type'] | 'ruler' | null) => {
    if (onToolChange) onToolChange(tool);
    setInternalActiveTool(tool);
  }, [onToolChange]);

  const [isLineMenuOpen, setIsLineMenuOpen] = useState(false);
  const [lastLineTool, setLastLineTool] = useState<Drawing['type']>('trendline');
  const lineMenuRef = useRef<HTMLDivElement>(null);
  const [internalDrawings, setInternalDrawings] = useState<Drawing[]>([]);
  const drawings = propsDrawings !== undefined ? propsDrawings : internalDrawings;
  const setDrawings = useCallback((d: Drawing[] | ((prev: Drawing[]) => Drawing[])) => {
    if (typeof d === 'function') {
      const next = d(drawings);
      if (onDrawingsChange) onDrawingsChange(next);
      setInternalDrawings(next);
    } else {
      if (onDrawingsChange) onDrawingsChange(d);
      setInternalDrawings(d);
    }
  }, [drawings, onDrawingsChange]);

  const [resetViewCounter, setResetViewCounter] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const prevSymbolRef = useRef<string>(symbol);
  const prevTimeframeRef = useRef<string>(timeframe);
  const [isChangingTimeframe, setIsChangingTimeframe] = useState(false);
  const [loadedPartsCount, setLoadedPartsCount] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const [internalMagnetEnabled, setInternalMagnetEnabled] = useState(false);
  const magnetEnabled = propsMagnetEnabled !== undefined ? propsMagnetEnabled : internalMagnetEnabled;
  const setMagnetEnabled = useCallback((enabled: boolean) => {
    if (onMagnetChange) onMagnetChange(enabled);
    setInternalMagnetEnabled(enabled);
  }, [onMagnetChange]);
  
  // Replay State
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [internalReplaySpeed, setInternalReplaySpeed] = useState(1000); // ms per candle

  const isPlaying = propsIsPlaying !== undefined ? propsIsPlaying : internalIsPlaying;
  const setIsPlaying = propsSetIsPlaying !== undefined ? propsSetIsPlaying : setInternalIsPlaying;
  const replaySpeed = propsReplaySpeed !== undefined ? propsReplaySpeed : internalReplaySpeed;
  const setReplaySpeed = propsSetReplaySpeed !== undefined ? propsSetReplaySpeed : setInternalReplaySpeed;

  // Sync internal replay state with isReplayMode prop
  useEffect(() => {
    if (isReplayMode) {
      setIsLive(false);
      if (replayIndex === null && candles.length > 0) {
        setReplayIndex(candles.length - 1);
        setActiveTool('replay' as any);
      }
    } else {
      setReplayIndex(null);
      setIsPlaying(false);
      if ((activeTool as any) === 'replay') {
        setActiveTool(null);
      }
    }
  }, [isReplayMode, candles.length > 0]);
  
  const [activeVariant, setActiveVariant] = useState<any>(null);
  const drawingsRef = useRef<Drawing[]>([]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  const [showExtraTf, setShowExtraTf] = useState(false);
  const tfDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tfDropdownRef.current && !tfDropdownRef.current.contains(event.target as Node)) {
        setShowExtraTf(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [history, setHistory] = useState<Drawing[][]>([[]]);
  const [currentStep, setCurrentStep] = useState(0);

  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  const numericCurrentPrice = currentPrice !== undefined 
    ? (typeof currentPrice === 'string' ? parseFloat(currentPrice) : currentPrice)
    : numericPrice;

  // Auto-scroll to present when in Live mode and new candles arrive
  // Removed redundant reset on every candle to prevent "jumping"
  // View is reset only on symbol/timeframe change or manual reset

  const handleResetView = () => {
    setIsLive(true);
    setResetViewCounter(prev => prev + 1);
  };
  
  const getBybitTimeframe = (tf: string) => {
    const map: Record<string, string> = {
      '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
      '1d': 'D', '1w': 'W'
    };
    return map[tf] || tf.replace('m', '');
  };

  const fetchPart = async (targetSymbol: string, isFut: boolean, useBybit: boolean, tf: string, endTime?: number) => {
    try {
      if (useBybit) {
        const category = isFut ? 'linear' : 'spot';
        const btf = getBybitTimeframe(tf);
        let url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${targetSymbol.toUpperCase()}&interval=${btf}&limit=600`;
        if (endTime) url += `&end=${endTime}`;
        const resp = await fetch(url);
        if (resp.status === 429) return 'RATE_LIMIT';
        const json = await resp.json();
        if (json.retCode !== 0) return null;
        return { data: json.result?.list || null, source: 'BYBIT' };
      } else {
        const host = isFut ? 'fapi.binance.com' : 'api.binance.com';
        const path = isFut ? '/fapi/v1/klines' : '/api/v3/klines';
        let url = `https://${host}${path}?symbol=${targetSymbol.toUpperCase()}&interval=${tf}&limit=600`;
        if (endTime) url += `&endTime=${endTime}`;
        const resp = await fetch(url);
        if (resp.status === 429) return 'RATE_LIMIT';
        if (!resp.ok) return null;
        return { data: await resp.json(), source: 'BINANCE' };
      }
    } catch (e) { return null; }
  };

  const parseKlines = (data: any[], source: string): Candle[] => {
    if (source === 'BYBIT') {
      return data.map((d: any) => ({
        time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), 
        low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
      })).reverse();
    }
    return data.map((d: any) => ({
      time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), 
      low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
    }));
  };

  const loadMoreHistory = useCallback(async () => {
    if (isFetchingMore || loadedPartsCount >= 5 || !activeVariant || candles.length === 0) return;
    
    setIsFetchingMore(true);
    try {
      const nextEnd = candles[0].time - 1;
      const res = await fetchPart(activeVariant.s, activeVariant.f, activeVariant.b, timeframe, nextEnd);
      
      if (res && res !== 'RATE_LIMIT' && Array.isArray(res.data) && res.data.length > 0) {
        const more = parseKlines(res.data, res.source);
        let addedCount = 0;
        setCandles(prev => {
          const existingTimes = new Set(prev.map(c => c.time));
          const uniqueMore = more.filter(c => !existingTimes.has(c.time));
          addedCount = uniqueMore.length;
          return [...uniqueMore, ...prev].sort((a, b) => a.time - b.time);
        });
        
        // Adjust replay index if active
        setReplayIndex(prev => {
          if (prev !== null && addedCount > 0) {
            return prev + addedCount;
          }
          return prev;
        });
        
        setLoadedPartsCount(prev => prev + 1);
      }
    } catch (e) {
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, loadedPartsCount, activeVariant, candles, timeframe]);

  const handleScroll = useCallback((info?: { startIdx: number; totalCandles: number }) => {
    if (isLive) setIsLive(false);
    
    // Lazy load logic: if we are near the left edge (startIdx < 50)
    // and we haven't loaded all 5 parts yet, and not currently fetching
    if (info && info.startIdx < 50 && !isFetchingMore && loadedPartsCount < 5 && activeVariant) {
      loadMoreHistory();
    }
  }, [isLive, isFetchingMore, loadedPartsCount, activeVariant, loadMoreHistory]);

  const getTimeframeMs = (tf: string): number => {
    const unit = tf.slice(-1);
    const value = parseInt(tf.slice(0, -1));
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  };

  useEffect(() => {
    if (!numericCurrentPrice || isNaN(numericCurrentPrice)) return;
    
    const tfMs = getTimeframeMs(timeframe);
    
    const updateCandles = () => {
      if (isSyncing) return;
      const now = Date.now();
      setCandles(prev => {
        if (prev.length === 0) {
          // Fallback: If no history, create initial candle to allow rendering
          const currentCandleTime = Math.floor(now / tfMs) * tfMs;
          return [{
            time: currentCandleTime,
            open: numericCurrentPrice,
            high: numericCurrentPrice,
            low: numericCurrentPrice,
            close: numericCurrentPrice,
            volume: 0
          }];
        }
        
        const last = prev[prev.length - 1];
        const nextCandleTime = last.time + tfMs;
        
        // Robust check: if current time passed the end of the last candle
        if (now >= nextCandleTime) {
          // New candle period started
          const newCandleTime = Math.floor(now / tfMs) * tfMs;
          
          // Avoid duplicate timestamps
          if (newCandleTime <= last.time) return prev;

          return [...prev, {
            time: newCandleTime,
            open: numericCurrentPrice,
            high: numericCurrentPrice,
            low: numericCurrentPrice,
            close: numericCurrentPrice,
            volume: 0
          }];
        } else {
          // Update existing candle
          const updatedLast = { ...last };
          updatedLast.close = numericCurrentPrice;
          updatedLast.high = Math.max(updatedLast.high, numericCurrentPrice);
          updatedLast.low = Math.min(updatedLast.low, numericCurrentPrice);
          
          // Check if anything actually changed to avoid unnecessary re-renders
          if (updatedLast.close === last.close && 
              updatedLast.high === last.high && 
              updatedLast.low === last.low) {
            return prev;
          }
          
          return [...prev.slice(0, -1), updatedLast];
        }
      });
    };

    updateCandles();
    
    // Run an interval to catch rollovers even if price doesn't move
    const interval = setInterval(updateCandles, 200);
    return () => clearInterval(interval);
  }, [numericCurrentPrice, timeframe, symbol, isSyncing]);

  useEffect(() => {
    let isDisposed = false;
    setFetchError(false);
    setIsSyncing(true);
    
    // Detect symbol change
    if (prevSymbolRef.current !== symbol) {
      setCandles([]);
      setResetViewCounter(prev => prev + 1);
      setIsLive(true);
      setIsReplayMode?.(false);
      setReplayIndex(null);
      setIsPlaying(false);
      prevSymbolRef.current = symbol;
      setIsChangingTimeframe(false);
    }
    
    // Detect timeframe change
    if (prevTimeframeRef.current !== timeframe) {
      setIsChangingTimeframe(true);
      setResetViewCounter(prev => prev + 1);
      setIsReplayMode?.(false);
      setReplayIndex(null);
      setIsPlaying(false);
      prevTimeframeRef.current = timeframe;
    }
    
    setLoadedPartsCount(1);
    setActiveVariant(null);

    const loadChartData = async () => {
      const myIndex = globalRequestIndex++;
      await new Promise(resolve => setTimeout(resolve, (myIndex % 50) * 80));
      if (isDisposed) return;

      try {
        const rawSymbol = symbol.replace(/[\/\s]/g, '').toUpperCase();
        const cleanBase = rawSymbol.replace(/USDT$/, '');
        // Fix regex order: longest first to avoid partial matches (e.g. 1000 matching first 4 digits of 1000000)
        const baseNoP = cleanBase.replace(/^(1000000|10000|1000)/, '');
        
        // Symbols that are known to cause issues or don't exist on Binance
        const SYMBOL_BLACKLIST = [
          '1000ENAUSDT', '1000SATSUSDT', '1000BONKUSDT', '1000RATSUSDT', 
          '1000CATIUSDT', '1000XUSDT', '1000000ENAUSDT', '10000ENAUSDT',
          '10000BTCUSDT', '10000LTCUSDT', '1000000LTCUSDT'
        ];

        const variants: { s: string, f: boolean, b: boolean }[] = [];
        const isBybit = exchange?.toLowerCase().includes('bybit');

        const fillVariants = (bybit: boolean) => {
          if (bybit) {
            // Bybit logic: supports prefixes
            variants.push({ s: rawSymbol, f: marketType === 'FUTURES', b: true });
            variants.push({ s: rawSymbol, f: marketType !== 'FUTURES', b: true });
            ['1000', '1000000', '10000'].forEach(p => {
              variants.push({ s: p + baseNoP + 'USDT', f: true, b: true });
              variants.push({ s: p + baseNoP + 'USDT', f: false, b: true });
            });
            variants.push({ s: baseNoP + 'USDT', f: false, b: true });
            variants.push({ s: baseNoP + 'USDT', f: true, b: true });
          } else {
            // Binance logic: NEVER uses prefixes like 1000, 1000000
            // We strictly use the base symbol without any leading digits that look like Bybit prefixes
            const binanceSymbol = baseNoP + 'USDT';
            variants.push({ s: binanceSymbol, f: marketType === 'FUTURES', b: false });
            variants.push({ s: binanceSymbol, f: marketType !== 'FUTURES', b: false });
          }
        };

        fillVariants(isBybit);
        fillVariants(!isBybit);

        const unique = variants.filter((v, i, s) => i === s.findIndex(t => t.s === v.s && t.f === v.f && t.b === v.b));

        let candlesFound: Candle[] = [];
        let variantUsed: any = null;

        for (const v of unique) {
          if (isDisposed) break;
          
          // Skip blacklisted symbols for Binance to avoid CORS/400 errors
          // Also skip any symbol for Binance that still starts with digits (likely a missed Bybit prefix)
          if (!v.b && (SYMBOL_BLACKLIST.includes(v.s) || /^\d+/.test(v.s))) continue;
          
          const res = await fetchPart(v.s, v.f, v.b, timeframe);
          if (res === 'RATE_LIMIT') { await new Promise(r => setTimeout(r, 600)); continue; }
          if (res && Array.isArray(res.data) && res.data.length > 0) {
            candlesFound = parseKlines(res.data, res.source);
            variantUsed = v;
            break;
          }
        }

        if (isDisposed) return;

        if (candlesFound.length > 0) {
          setCandles(candlesFound);
          setActiveVariant(variantUsed);
          setIsSyncing(false);
          setIsChangingTimeframe(false);
        } else {
          // No history found after all variants
          setIsSyncing(false);
          setIsChangingTimeframe(false);
          // Only error if price is also missing
          if (!numericPrice) setFetchError(true);
        }
      } catch (err) {
        if (!isDisposed) { 
          setFetchError(true); 
          setIsSyncing(false); 
          setIsChangingTimeframe(false);
        }
      }
    };

    loadChartData();
    return () => { isDisposed = true; };
  }, [symbol, timeframe, marketType, retryCount, exchange]);

  useEffect(() => {
    if (isReplayMode && replayIndex !== null && candles[replayIndex]) {
      TradingSimulatorService.getInstance().setSimulatedPrice(symbol, candles[replayIndex].close);
    } else {
      TradingSimulatorService.getInstance().setSimulatedPrice(symbol, null);
    }
  }, [isReplayMode, replayIndex, candles, symbol]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && isReplayMode && replayIndex !== null && replayIndex < candles.length - 1) {
      interval = setInterval(() => {
        setReplayIndex(prev => (prev !== null && prev < candles.length - 1) ? prev + 1 : prev);
      }, replaySpeed);
    } else if (replayIndex === candles.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isReplayMode, replayIndex, candles.length, replaySpeed]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lineMenuRef.current && !lineMenuRef.current.contains(event.target as Node)) {
        setIsLineMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTfChange = (tf: string) => {
    onTimeframeChange?.(tf);
  };

  const pushToHistory = useCallback((newDrawings: Drawing[]) => {
    setHistory(prev => {
      const next = prev.slice(0, currentStep + 1);
      next.push(newDrawings);
      return next.length > 100 ? next.slice(1) : next;
    });
    setCurrentStep(prev => Math.min(prev + 1, 99));
    setDrawings(newDrawings);
  }, [currentStep]);

  const undo = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setDrawings(history[prevStep]);
    }
  }, [currentStep, history]);

  const redo = useCallback(() => {
    if (currentStep < history.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setDrawings(history[nextStep]);
    }
  }, [currentStep, history]);

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    canUndo: currentStep > 0,
    canRedo: currentStep < history.length - 1
  }), [undo, redo, currentStep, history.length]);

  useEffect(() => {
    onHistoryChange?.({
      canUndo: currentStep > 0,
      canRedo: currentStep < history.length - 1
    });
  }, [currentStep, history.length, onHistoryChange]);

  const onDrawingComplete = useCallback((drawing: Drawing) => {
    const nextDrawings = [...drawingsRef.current, drawing];
    pushToHistory(nextDrawings);
    if (activeTool !== 'brush') {
      setActiveTool(null);
    }
  }, [pushToHistory, activeTool]);

  const handleClearAll = () => {
    if (drawings.length > 0) {
      pushToHistory([]);
    }
  };

  return (
    <div className={`flex h-full w-full ${isAdditional ? 'bg-[#0d0d0d]' : 'bg-[#020203]'} text-white relative overflow-hidden group/chart border border-purple-900/40 hover:border-purple-800/60 rounded-lg flex-col transition-all duration-500 shadow-2xl`}>
      
      <div className="flex-1 flex min-h-0 relative gap-1.5 p-1.5">
        <div className="w-8 sm:w-10 border border-white/10 bg-white/5 backdrop-blur-md flex flex-col items-center py-3 gap-2 shrink-0 z-50 overflow-y-auto no-scrollbar max-h-full rounded-xl shadow-xl">
          <button 
            onClick={() => {
              setActiveTool(null);
              setIsLineMenuOpen(false);
            }}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all group/btn relative shrink-0 ${
              activeTool === null 
              ? 'bg-zinc-700 text-white' 
              : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <CustomCrosshairIcon />
          </button>

          {/* UNDO/REDO - Mobile only at top */}
          <div className="flex md:hidden flex-col gap-2 w-full items-center py-1 border-b border-white/5 mb-1 shrink-0">
            <button 
              onClick={undo}
              className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${currentStep > 0 ? 'text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}
              disabled={currentStep === 0}
            >
              <CustomUndoIcon size={16} />
            </button>
            <button 
              onClick={redo}
              className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${currentStep < history.length - 1 ? 'text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}
              disabled={currentStep >= history.length - 1}
            >
              <CustomRedoIcon size={16} />
            </button>
          </div>

          <div className="w-5 sm:w-6 h-[1px] bg-white/10 mx-1 shrink-0"></div>

          <button 
            onClick={() => setActiveTool(activeTool === 'brush' ? null : 'brush')}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all group/btn relative shrink-0 ${
              activeTool === 'brush' 
              ? 'bg-zinc-700 text-white' 
              : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <Brush size={14} className="sm:w-[16px] sm:h-[16px]" />
          </button>

          {/* Mobile Grouped Line Tools */}
          <div className="md:hidden relative" ref={lineMenuRef}>
            <div className="flex items-center gap-0.5">
              <button 
                onClick={() => {
                  setActiveTool(activeTool === lastLineTool ? null : lastLineTool);
                  setIsLineMenuOpen(false);
                }}
                className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-l-lg transition-all group/btn relative shrink-0 ${
                  ['trendline', 'ray', 'hline', 'hray', 'vline', 'crossline'].includes(activeTool as string)
                  ? 'bg-zinc-700 text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }`}
              >
                {lastLineTool === 'trendline' && <TrendLineIcon />}
                {lastLineTool === 'ray' && <RayIcon />}
                {lastLineTool === 'hline' && <HLineIcon />}
                {lastLineTool === 'hray' && <HRayIcon />}
                {lastLineTool === 'vline' && <VLineIcon />}
                {lastLineTool === 'crossline' && <CrossLineIcon />}
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLineMenuOpen(!isLineMenuOpen);
                }}
                className={`w-3 h-6 sm:h-7 flex items-center justify-center rounded-r-md transition-all ${isLineMenuOpen ? 'text-white bg-purple-500/30' : 'text-gray-400 bg-white/5 hover:bg-white/10'}`}
              >
                <ChevronRight size={10} className={`transition-transform duration-200 ${isLineMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Desktop Individual Line Tools */}
          <div className="hidden md:flex flex-col gap-1.5 items-center">
            {[
              { id: 'trendline', icon: <TrendLineIcon />, label: t.trend_line || 'Trend Line' },
              { id: 'ray', icon: <RayIcon />, label: t.ray || 'Ray' },
              { id: 'hline', icon: <HLineIcon />, label: t.h_line || 'Horizontal Line' },
              { id: 'hray', icon: <HRayIcon />, label: t.h_ray || 'Horizontal Ray' },
              { id: 'vline', icon: <VLineIcon />, label: t.v_line || 'Vertical Line' },
              { id: 'crossline', icon: <CrossLineIcon />, label: t.cross_line || 'Cross Line' },
              { id: 'circle', icon: <CircleIcon size={14} />, label: t.circle || 'Circle' },
              { id: 'rectangle', icon: <RectangleIcon />, label: t.rectangle || 'Rectangle' }
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id as any)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all group/btn relative shrink-0 ${
                  activeTool === tool.id 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }`}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}
          </div>

          <div className="w-5 sm:w-6 h-[1px] bg-white/10 mx-1 shrink-0"></div>

          <button 
            onClick={() => setActiveTool(activeTool === 'ruler' ? null : 'ruler')}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all group/btn relative shrink-0 ${
              activeTool === 'ruler' 
              ? 'bg-zinc-700 text-white' 
              : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <Ruler size={14} className="sm:w-[16px] sm:h-[16px]" />
          </button>

          <button 
            onClick={() => setMagnetEnabled(!magnetEnabled)}
            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all group/btn relative shrink-0 ${
              magnetEnabled 
              ? 'bg-zinc-700 text-white' 
              : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <Magnet size={14} className="sm:w-[16px] sm:h-[16px]" />
          </button>

          <div className="mt-auto flex flex-col items-center gap-2 w-full">
            <div className="w-5 sm:w-6 h-[1px] bg-white/10 mx-1 shrink-0"></div>
            <button 
              onClick={handleClearAll}
              className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                drawings.length > 0 
                ? 'text-gray-500 hover:bg-red-500/10 hover:text-red-400' 
                : 'text-gray-700 opacity-10 cursor-not-allowed'
              }`}
            >
              <Trash2 size={12} className="sm:w-[14px] sm:h-[14px]" />
            </button>
          </div>
        </div>

        <div className={`relative flex-1 ${isAdditional ? 'bg-transparent' : 'bg-[#020203]'}`}>
          {fetchError ? (
            <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <BarChart2 size={32} className="text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">{t.chart_unavailable}</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-[240px] leading-relaxed">
                {t.instrument_no_history.replace('{symbol}', symbol)}
              </p>
              <button 
                onClick={() => setRetryCount(prev => prev + 1)} 
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all shadow-lg"
              >
                <RefreshCw size={14} /> {t.retry_search}
              </button>
            </div>
          ) : (isSyncing && candles.length === 0) ? (
            <div className="absolute inset-0 z-20 bg-[#020203] flex flex-col items-center justify-center">
               <div className="w-12 h-12 border-2 border-white/5 border-t-zinc-500 rounded-full animate-spin mb-4" />
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">Syncing Stream...</span>
            </div>
          ) : (
            <>
              {isChangingTimeframe && (
                <div className="absolute inset-0 z-30 bg-[#020203] flex flex-col items-center justify-center animate-in fade-in duration-200">
                   <div className="w-10 h-10 border-2 border-white/5 border-t-zinc-500 rounded-full animate-spin mb-3" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Updating Timeframe...</span>
                </div>
              )}
              <CustomChartEngine 
                data={candles} 
                isLong={isLong} 
                isExpanded={isExpanded} 
                height={height}
                activeTool={activeTool}
                onToolChange={setActiveTool}
                magnetEnabled={magnetEnabled}
                onDrawingComplete={onDrawingComplete}
                onDrawingsChange={pushToHistory}
                drawings={drawings}
                timeframe={timeframe}
                currentPrice={numericPrice}
                resetViewTrigger={resetViewCounter}
                onScroll={handleScroll}
                alerts={alerts.filter(a => a.symbol === symbol)}
                onAlertChange={onAlertChange}
                replayIndex={replayIndex}
                onReplayIndexChange={setReplayIndex}
                isReplayPlaying={isPlaying}
                language={language}
                positions={positions.filter(p => p.symbol === symbol)}
                pendingOrders={pendingOrders.filter(o => o.symbol === symbol)}
              />
              
            </>
          )}
        </div>
      </div>

      {isReplayMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-10 py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
            <div className="flex items-center gap-5 pr-8 border-r border-white/10">
              <button 
                onClick={() => setReplaySpeed(prev => Math.min(5000, prev + 500))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Rewind size={16} />
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-full text-white shadow-lg transition-all active:scale-95"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>
              <button 
                onClick={() => setReplaySpeed(prev => Math.max(100, prev - 500))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FastForward size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-4 pr-8 border-r border-zinc-700/50">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{t.speed}:</span>
              <span className="text-xs font-mono text-zinc-300 w-10 text-center font-bold">{(1000 / replaySpeed).toFixed(1)}x</span>
            </div>

            <button 
              onClick={() => {
                setIsReplayMode(false);
                setReplayIndex(null);
                setIsPlaying(false);
                setActiveTool(null);
              }}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-600 hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] group/close"
              title={t.exit}
            >
              <X size={18} strokeWidth={3} className="group-hover/close:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawing Tools Expansion - Positioned at the bottom of the chart block */}
      {isLineMenuOpen && (
        <div className="absolute bottom-0 left-0 right-0 z-[100] md:hidden animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-white/10 p-2 flex items-center justify-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            {[
              { id: 'trendline', icon: <TrendLineIcon />, label: t.trend_line || 'Trend Line' },
              { id: 'ray', icon: <RayIcon />, label: t.ray || 'Ray' },
              { id: 'hline', icon: <HLineIcon />, label: t.h_line || 'Horizontal Line' },
              { id: 'hray', icon: <HRayIcon />, label: t.h_ray || 'Horizontal Ray' },
              { id: 'vline', icon: <VLineIcon />, label: t.v_line || 'Vertical Line' },
              { id: 'crossline', icon: <CrossLineIcon />, label: t.cross_line || 'Cross Line' },
              { id: 'circle', icon: <CircleIcon size={16} />, label: t.circle || 'Circle' },
              { id: 'rectangle', icon: <RectangleIcon />, label: t.rectangle || 'Rectangle' }
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id as any);
                  setLastLineTool(tool.id as any);
                  setIsLineMenuOpen(false);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                  activeTool === tool.id ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <button 
              onClick={() => setIsLineMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}));

export default MiniChart;
