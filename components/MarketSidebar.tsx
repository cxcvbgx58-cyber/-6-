
import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Newspaper, Plus, Gauge, ChevronRight, ChevronLeft, Info, ExternalLink, RefreshCw, Trash2, ArrowUp, ArrowDown, X, Wallet, History, TrendingUp, Rewind, Pause, Play, FastForward, BarChart2, Search, Brush, Ruler, Magnet, MousePointer2 } from 'lucide-react';
import { CandlestickPlusIcon } from './UI/Icons';
import { Language, translations } from '../src/translations';
import { MarketCoin } from '../models';
import { simulatorService, SimulatorState, Position } from '../services/trading-simulator.service';

interface MarketSidebarProps {
  language: Language;
  chartLayout: number;
  setChartLayout: (val: number) => void;
  alerts: { id: string; symbol: string; price: number; type: 'above' | 'below' }[];
  onAddAlert: (alert: { symbol: string; price: number; type: 'above' | 'below' }) => void;
  onRemoveAlert: (id: string) => void;
  activeCoin: MarketCoin | null;
  onSelectCoin: (coin: MarketCoin) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  comparisonCoins: MarketCoin[];
  replayState: { isReplayMode: boolean; isPlaying: boolean; replaySpeed: number };
  onToggleReplayMode: () => void;
  onTogglePlayPause: () => void;
  onSetReplaySpeed: (speed: number) => void;
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  magnetEnabled: boolean;
  onToggleMagnet: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenCoinSelector?: () => void;
  checkSubscription: (featureName: string) => boolean;
}

const isCoinExcluded = (coin: Partial<MarketCoin>) => {
  if (!coin.symbol || !coin.baseAsset || !coin.exchange || !coin.market) return false;
  const symbol = coin.baseAsset.toUpperCase();
  const exchange = coin.exchange;
  const market = coin.market;

  // Binance
  if (exchange === 'Binance') {
    const toRemove = ['NEAR', 'AVAX', 'BCH', 'TAO', 'SHIB', 'RENDER', 'OP', 'FIL', 'INJ', 'AXS', 'LTC', 'SUI', 'POL', 'PEPE'];
    if (toRemove.includes(symbol)) return true;
    if (symbol === 'ONDO' && market === 'FUTURES') return true;
    if (symbol === 'ICP' && market === 'SPOT') return true;
    if (symbol === 'PENDLE' && market === 'SPOT') return true;
  }

  // Bybit
  if (exchange === 'Bybit') {
    const bybitGeneralRemove = ['NEAR', 'STX', 'STRK', 'PEPE', 'ENA'];
    if (bybitGeneralRemove.includes(symbol)) return true;

    if (market === 'FUTURES') {
      const toRemove = ['AVAX', 'BCH', 'LTC', 'GALA', 'ENA', 'ONDO', 'SUI', '1000BONK', '1000FLOKI', 'SEI'];
      if (toRemove.includes(symbol)) return true;
    }
    if (market === 'SPOT') {
      const toRemove = ['RENDER', 'OP'];
      if (toRemove.includes(symbol)) return true;
    }
  }

  return false;
};

export const MarketSidebar: React.FC<MarketSidebarProps> = ({ 
  language, 
  chartLayout, 
  setChartLayout, 
  alerts, 
  onAddAlert, 
  onRemoveAlert,
  activeCoin,
  onSelectCoin,
  isOpen,
  setIsOpen,
  comparisonCoins,
  replayState,
  onToggleReplayMode,
  onTogglePlayPause,
  onSetReplaySpeed,
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onClearAll,
  magnetEnabled,
  onToggleMagnet,
  canUndo,
  canRedo,
  onOpenCoinSelector,
  checkSubscription
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'news' | 'alerts' | 'charts' | 'fng' | 'simulator' | null>(null);
  const [fngData, setFngData] = useState<{ value: string; classification: string } | null>(null);
  const [news, setNews] = useState<{ title: string; url: string; time: string }[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  
  // Coin list for charts tab
  const [allCoins, setAllCoins] = useState<MarketCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [coinSearchQuery, setCoinSearchQuery] = useState('');

  useEffect(() => {
    if (activeTab === 'charts' && allCoins.length === 0) {
      fetchCoins();
    }
  }, [activeTab]);

  const fetchCoins = async () => {
    setLoadingCoins(true);
    try {
      const fetchWithTimeout = async (url: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          return await res.json();
        } catch (e) {
          clearTimeout(timeout);
          throw e;
        }
      };

      const results = await Promise.allSettled([
        fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr'),
        fetchWithTimeout('https://fapi.binance.com/fapi/v1/ticker/24hr'),
        fetchWithTimeout('https://api.bybit.com/v5/market/tickers?category=spot'),
        fetchWithTimeout('https://api.bybit.com/v5/market/tickers?category=linear'),
      ]);

      let coins: MarketCoin[] = [];

      if (results[0].status === 'fulfilled') {
        const bSpot = results[0].value.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => {
          const base = t.symbol.replace('USDT', '');
          return {
            symbol: t.symbol, baseAsset: base, price: parseFloat(t.lastPrice),
            change24h: parseFloat(t.priceChangePercent), volume24h: parseFloat(t.quoteVolume),
            market: 'SPOT', exchange: 'Binance', logo: `/api/logos/${base.toUpperCase()}`
          } as MarketCoin;
        }).filter(c => !isCoinExcluded(c));
        coins = [...coins, ...bSpot];
      }

      if (results[1].status === 'fulfilled') {
        const bFut = results[1].value.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => {
          const base = t.symbol.replace('USDT', '');
          return {
            symbol: t.symbol, baseAsset: base, price: parseFloat(t.lastPrice),
            change24h: parseFloat(t.priceChangePercent), volume24h: parseFloat(t.quoteVolume),
            market: 'FUTURES', exchange: 'Binance', logo: `/api/logos/${base.toUpperCase()}`
          } as MarketCoin;
        }).filter(c => !isCoinExcluded(c));
        coins = [...coins, ...bFut];
      }

      if (results[2].status === 'fulfilled') {
        const ySpot = results[2].value.result.list.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => {
          const base = t.symbol.replace('USDT', '');
          return {
            symbol: t.symbol, baseAsset: base, price: parseFloat(t.lastPrice),
            change24h: parseFloat(t.price24hPcnt) * 100, volume24h: parseFloat(t.turnover24h),
            market: 'SPOT', exchange: 'Bybit', logo: `/api/logos/${base.toUpperCase()}`
          } as MarketCoin;
        }).filter(c => !isCoinExcluded(c));
        coins = [...coins, ...ySpot];
      }

      if (results[3].status === 'fulfilled') {
        const yFut = results[3].value.result.list.filter((t: any) => t.symbol.endsWith('USDT')).map((t: any) => {
          const base = t.symbol.replace('USDT', '');
          return {
            symbol: t.symbol, baseAsset: base, price: parseFloat(t.lastPrice),
            change24h: parseFloat(t.price24hPcnt) * 100, volume24h: parseFloat(t.turnover24h),
            market: 'FUTURES', exchange: 'Bybit', logo: `/api/logos/${base.toUpperCase()}`
          } as MarketCoin;
        }).filter(c => !isCoinExcluded(c));
        coins = [...coins, ...yFut];
      }

      // Sort by volume and remove duplicates
      const uniqueCoins = Array.from(new Map(coins.map(c => [`${c.exchange}:${c.market}:${c.symbol}`, c])).values());
      setAllCoins(uniqueCoins.sort((a, b) => b.volume24h - a.volume24h));
    } catch (error) {
      console.error("Error fetching coins in sidebar:", error);
    } finally {
      setLoadingCoins(false);
    }
  };

  const filteredCoins = useMemo(() => {
    if (!coinSearchQuery) return allCoins.slice(0, 50);
    return allCoins.filter(c => 
      c.symbol.toLowerCase().includes(coinSearchQuery.toLowerCase()) ||
      c.baseAsset.toLowerCase().includes(coinSearchQuery.toLowerCase())
    ).slice(0, 50);
  }, [allCoins, coinSearchQuery]);
  
  // Simulator state
  const [simState, setSimState] = useState<SimulatorState>(simulatorService.getCurrentState());
  const [simulatedPrices, setSimulatedPrices] = useState<{ [symbol: string]: number }>({});
  const [tradeAmount, setTradeAmount] = useState('0');
  const [entryPrice, setEntryPrice] = useState('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [leverage, setLeverage] = useState(1);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState('');
  const [openTPSL, setOpenTPSL] = useState<string | null>(null);

  // Calculate Unrealized PnL
  const unrealizedPnL = simState.positions.reduce((acc, pos) => {
    const simulatedPrice = simulatedPrices[pos.symbol];
    const currentPrice = simulatedPrice !== undefined ? simulatedPrice : ((activeCoin && activeCoin.symbol === pos.symbol) ? activeCoin.price : pos.entryPrice);
    const isLong = pos.side === 'LONG';
    const size = pos.amount * pos.leverage;
    const pnl = isLong 
      ? (currentPrice / pos.entryPrice - 1) * size 
      : (1 - currentPrice / pos.entryPrice) * size;
    return acc + pnl;
  }, 0);

  const totalMargin = simState.positions.reduce((acc, pos) => acc + pos.amount, 0);
  const totalEquity = simState.balance + totalMargin + unrealizedPnL;

  useEffect(() => {
    const sub = simulatorService.getState$().subscribe(setSimState);
    const priceSub = simulatorService.simulatedPriceObs$.subscribe(setSimulatedPrices);
    return () => {
      sub.unsubscribe();
      priceSub.unsubscribe();
    };
  }, []);

  const formatBalance = (val: string) => {
    // Remove non-digits
    const clean = val.replace(/[^\d.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) parts.length = 2;
    
    // Format integer part with spaces
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    return parts.join('.');
  };

  const formatSimValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal < 1000) {
      return val.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  };

  const formatPrice = (price: number) => {
    if (price === 0) return '0';
    const absPrice = Math.abs(price);
    let decimals = 2;
    if (absPrice < 0.0001) decimals = 8;
    else if (absPrice < 0.01) decimals = 6;
    else if (absPrice < 1) decimals = 4;
    
    return price.toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const handleUpdateBalance = () => {
    const clean = tempBalance.replace(/\s/g, '');
    let newBalance = parseFloat(clean);
    if (!isNaN(newBalance) && newBalance >= 0) {
      // Cap at 100 million
      if (newBalance > 100000000) newBalance = 100000000;
      simulatorService.setBalance(newBalance);
      setIsEditingBalance(false);
    }
  };

  useEffect(() => {
    if (activeCoin && orderType === 'MARKET') {
      const simulatedPrice = simulatedPrices[activeCoin.symbol];
      const price = simulatedPrice !== undefined ? simulatedPrice : activeCoin.price;
      setEntryPrice(formatBalance(price.toString()));
    }
  }, [activeCoin?.price, orderType, simulatedPrices]);

  useEffect(() => {
    if (activeCoin) {
      const simulatedPrice = simulatedPrices[activeCoin.symbol];
      const price = simulatedPrice !== undefined ? simulatedPrice : activeCoin.price;
      simulatorService.checkLiquidations(activeCoin.symbol, activeCoin.exchange, activeCoin.market, price);
    }
  }, [activeCoin?.price, activeCoin?.symbol, activeCoin?.exchange, activeCoin?.market, simulatedPrices]);

  const handleTrade = (side: 'LONG' | 'SHORT') => {
    if (!activeCoin) return;
    const totalSize = parseFloat(tradeAmount.replace(/\s/g, ''));
    const price = parseFloat(entryPrice.replace(/\s/g, ''));
    if (isNaN(totalSize) || totalSize <= 0) return;
    if (isNaN(price) || price <= 0) return;

    // Calculate margin required
    const margin = totalSize / leverage;
    
    const simulatedPrice = simulatedPrices[activeCoin.symbol];
    const currentPrice = simulatedPrice !== undefined ? simulatedPrice : activeCoin.price;

    const success = simulatorService.openPosition(
      activeCoin.symbol,
      activeCoin.exchange,
      activeCoin.market,
      side,
      price,
      margin,
      leverage,
      orderType === 'LIMIT',
      currentPrice
    );

    if (!success) {
      alert(t.insufficient_balance);
    }
  };

  const handleClosePosition = (pos: Position) => {
    // In a real app, we'd get the latest price for this specific symbol
    // For now, if it's the active coin, use its price, otherwise use entry price (no pnl)
    const currentPrice = (activeCoin && activeCoin.symbol === pos.symbol) ? activeCoin.price : pos.entryPrice;
    simulatorService.closePosition(pos.id, currentPrice);
  };

  // Alert form state
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');

  useEffect(() => {
    const fetchFnG = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/');
        const json = await res.json();
        if (json.data && json.data[0]) {
          setFngData({
            value: json.data[0].value,
            classification: json.data[0].value_classification
          });
        }
      } catch (e) {
        console.error('Failed to fetch FnG', e);
      }
    };
    fetchFnG();
  }, []);

  const fetchNews = async () => {
    setLoadingNews(true);
    try {
      const mockNews = language === 'ru' ? [
        { title: "Биткоин-ETF зафиксировали рекордный приток средств на фоне новых максимумов BTC", url: "https://www.coindesk.com", time: "2ч назад" },
        { title: "Обновление Ethereum Dencun успешно внедрено в основной сети", url: "https://cointelegraph.com", time: "5ч назад" },
        { title: "Рост экосистемы Solana продолжается с новыми рекордами DEX", url: "https://decrypt.co", time: "8ч назад" },
        { title: "SEC откладывает решение по заявкам на спотовые Ethereum-ETF", url: "https://www.theblock.co", time: "12ч назад" },
        { title: "Капитализация крипторынка превысила $3 трлн на фоне ралли альткоинов", url: "https://www.bloomberg.com/crypto", time: "1д назад" }
      ] : [
        { title: "Bitcoin ETFs see record inflows as BTC hits new highs", url: "https://www.coindesk.com", time: "2h ago" },
        { title: "Ethereum Dencun upgrade successfully implemented on mainnet", url: "https://cointelegraph.com", time: "5h ago" },
        { title: "Solana ecosystem growth continues with new DEX records", url: "https://decrypt.co", time: "8h ago" },
        { title: "SEC delays decision on spot Ethereum ETF applications", url: "https://www.theblock.co", time: "12h ago" },
        { title: "Crypto market cap surpasses $3 trillion as altcoins rally", url: "https://www.bloomberg.com/crypto", time: "1d ago" }
      ];
      setNews(mockNews);
    } catch (e) {
      console.error('Failed to fetch news', e);
    } finally {
      setLoadingNews(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'news') {
      fetchNews();
    }
  }, [isOpen, activeTab, language]);

  const getFngColor = (value: number) => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-green-400';
    return 'text-emerald-500';
  };

  const handleAddAlert = () => {
    if (!activeCoin || !alertPrice) return;
    const targetPrice = parseFloat(alertPrice);
    const type = targetPrice > activeCoin.price ? 'above' : 'below';
    onAddAlert({
      symbol: activeCoin.symbol,
      price: targetPrice,
      type: type
    });
    setIsAddingAlert(false);
    setAlertPrice('');
  };

  return (
    <div className={`flex h-full transition-all duration-300 ease-in-out ${isOpen ? 'w-80' : 'w-12'} border-l border-white/10 bg-[#080808] z-[150] relative portrait:hidden`}>
      {/* Icon Bar */}
      {!(isOpen && activeTab === 'news') && (
        <div className="w-12 flex flex-col items-center py-4 gap-6 shrink-0 border-r border-white/5">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => { 
                if (checkSubscription('News')) {
                  setIsOpen(true); 
                  setActiveTab('news'); 
                }
              }}
              className={`p-2 rounded-lg transition-all ${activeTab === 'news' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title="Crypto News"
            >
              <Newspaper size={20} />
            </button>

            <button 
              onClick={() => { 
                if (checkSubscription('Simulator')) {
                  setIsOpen(true); 
                  setActiveTab('simulator'); 
                }
              }}
              className={`p-1.5 rounded-lg transition-all relative flex flex-col items-center gap-0.5 ${activeTab === 'simulator' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title={t.simulator}
            >
              <TrendingUp size={20} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{(t as any).demo_label}</span>
              {simState.positions.length > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full border border-[#080808] animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              )}
            </button>

            <button 
              onClick={() => {
                if (checkSubscription('Simulator')) {
                  onToggleReplayMode();
                }
              }}
              className={`p-2 rounded-lg transition-all relative ${replayState.isReplayMode ? 'bg-zinc-700 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title="Market Replay"
            >
              <Rewind size={20} />
              {replayState.isReplayMode && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full border border-[#080808] animate-pulse" />
              )}
            </button>

            <button 
              onClick={() => { 
                if (checkSubscription('Notifications')) {
                  setIsOpen(true); 
                  setActiveTab('alerts'); 
                }
              }}
              className={`p-2 rounded-lg transition-all relative ${activeTab === 'alerts' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title="Set Alerts"
            >
              <Bell size={20} className={alerts.length > 0 ? 'text-white' : ''} />
              {alerts.length > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-[#080808] animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
              )}
            </button>

            <button 
              onClick={() => {
                if (checkSubscription('Multi-Charts')) {
                  if (onOpenCoinSelector) {
                    onOpenCoinSelector();
                  } else {
                    setIsOpen(true);
                    setActiveTab('charts');
                  }
                }
              }}
              className={`p-2 rounded-lg transition-all relative hidden md:flex ${activeTab === 'charts' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title="Additional Charts"
            >
              <CandlestickPlusIcon className={`w-5 h-5 ${chartLayout > 1 ? 'rotate-45 text-white' : ''} transition-transform duration-300`} />
              {chartLayout > 1 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-[#080808] animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
              )}
            </button>

            <button 
              onClick={() => { 
                if (checkSubscription('FnG')) {
                  setIsOpen(true); 
                  setActiveTab('fng'); 
                }
              }}
              className={`p-2 rounded-lg transition-all ${activeTab === 'fng' ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              title="Fear & Greed Index"
            >
              <Gauge size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Content Panel */}
      {isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeTab === 'news' && (
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              )}
              <h3 className="text-sm font-black uppercase tracking-widest text-white">
                {activeTab === 'news' && t.global_news}
                {activeTab === 'alerts' && t.alerts}
                {activeTab === 'charts' && t.add_chart}
                {activeTab === 'fng' && t.market_sentiment_label}
                {activeTab === 'simulator' && t.simulator}
              </h3>
            </div>
            {activeTab === 'news' && (
              <button onClick={fetchNews} className={`text-gray-500 hover:text-white ${loadingNews ? 'animate-spin' : ''}`}>
                <RefreshCw size={14} />
              </button>
            )}
            {activeTab === 'simulator' && (
              <button 
                onClick={() => { if(confirm(t.confirm_reset)) simulatorService.reset(); }} 
                className="text-gray-500 hover:text-red-400 transition-colors"
                title={t.reset_simulator}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-4">
            {activeTab === 'simulator' && (
              <div className="flex flex-col gap-6">
                {/* Balance Card */}
                <div className="p-3 bg-gradient-to-br from-zinc-900/40 to-black border border-zinc-800 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{(t as any).equity}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setIsEditingBalance(!isEditingBalance);
                          setTempBalance(simState.balance.toString());
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[8px] font-black text-zinc-400 transition-all"
                      >
                        <Plus size={10} />
                        {(t as any).top_up}
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditingBalance(!isEditingBalance);
                          setTempBalance(simState.balance.toString());
                        }}
                        className="p-1 text-gray-500 hover:text-zinc-400 transition-colors"
                        title={t.edit_balance}
                      >
                        <Wallet size={12} />
                      </button>
                    </div>
                  </div>
                  {isEditingBalance ? (
                    <div className="flex gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text"
                        value={tempBalance}
                        onChange={(e) => setTempBalance(formatBalance(e.target.value))}
                        autoFocus
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-black text-white focus:outline-none focus:border-zinc-500/50"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateBalance()}
                        onBlur={handleUpdateBalance}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div 
                        className={`text-lg font-black font-mono cursor-pointer hover:text-zinc-300 transition-colors tracking-tight ${unrealizedPnL > 0 ? 'text-[#00ff88]' : unrealizedPnL < 0 ? 'text-[#ff3355]' : 'text-white'}`}
                        onClick={() => {
                          setIsEditingBalance(true);
                          setTempBalance(simState.balance.toString());
                        }}
                      >
                        ${formatSimValue(totalEquity)}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[7px] text-gray-600 uppercase font-bold">{t.balance}: ${formatSimValue(simState.balance)}</span>
                        {unrealizedPnL !== 0 && (
                          <span className={`text-[7px] font-bold ${unrealizedPnL > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {unrealizedPnL > 0 ? '+' : ''}${formatSimValue(unrealizedPnL)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>


                {/* Trading Controls */}
                {activeCoin ? (
                  <div className="flex flex-col gap-4 p-4 bg-white/5 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={`/api/logos/${activeCoin.baseAsset}`} className="w-5 h-5 object-contain" alt="" />
                        <span className="text-xs font-black text-white uppercase">{activeCoin.symbol}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-white font-mono">${formatPrice(activeCoin.price)}</span>
                        <div className="flex gap-1 mt-1">
                          {[0, 0.25, 0.5, 1].map(pct => (
                            <button 
                              key={pct}
                              onClick={() => setTradeAmount(formatBalance(Math.floor(simState.balance * pct * leverage).toString()))}
                              className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                              {pct * 100}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-gray-500 uppercase font-black">{t.amount} (USDT)</label>
                          <span className="text-[10px] text-white font-black">
                            {Math.round((parseFloat(tradeAmount.replace(/\s/g, '')) / (simState.balance * leverage || 1)) * 100)}%
                          </span>
                        </div>
                        <input 
                          type="text"
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(formatBalance(e.target.value))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500/50 transition-all font-mono"
                        />
                        <div className="relative pt-1 pb-4">
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.min(100, Math.round((parseFloat(tradeAmount.replace(/\s/g, '')) / (simState.balance * leverage || 1)) * 100) || 0)}
                            onChange={(e) => {
                              let val = parseInt(e.target.value);
                              // Snapping logic
                              const snapThreshold = 3;
                              const snapPoints = [0, 25, 50, 75, 100];
                              for (const point of snapPoints) {
                                if (Math.abs(val - point) <= snapThreshold) {
                                  val = point;
                                  break;
                                }
                              }
                              const pct = val / 100;
                              setTradeAmount(formatBalance(Math.floor(simState.balance * pct * leverage).toString()));
                            }}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer 
                              [&::-webkit-slider-thumb]:appearance-none 
                              [&::-webkit-slider-thumb]:w-4 
                              [&::-webkit-slider-thumb]:h-4 
                              [&::-webkit-slider-thumb]:rounded-full 
                              [&::-webkit-slider-thumb]:bg-black 
                              [&::-webkit-slider-thumb]:border-2 
                              [&::-webkit-slider-thumb]:border-zinc-600
                              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]
                              [&::-webkit-slider-thumb]:transition-all
                              hover:[&::-webkit-slider-thumb]:border-zinc-400 relative z-10"
                          />
                          {/* Ticks for Amount Slider */}
                          <div className="absolute top-1 left-0 w-full pointer-events-none">
                            {[0, 25, 50, 75, 100].map(val => (
                              <div key={val} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${val}%` }}>
                                <div className="w-[1px] h-1 bg-white/20" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="relative h-3 -mt-3 mb-3">
                          {[0, 25, 50, 75, 100].map(val => (
                            <button 
                              key={val}
                              onClick={() => setTradeAmount(formatBalance(Math.floor(simState.balance * (val / 100) * leverage).toString()))}
                              className={`absolute text-[8px] font-black transition-colors ${Math.round((parseFloat(tradeAmount.replace(/\s/g, '')) / (simState.balance * leverage || 1)) * 100) === val ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}
                              style={{ 
                                left: `${val}%`,
                                transform: val === 100 ? 'translateX(-100%)' : val === 0 ? 'translateX(0)' : 'translateX(-50%)'
                              }}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black">{t.price}</label>
                        <div className="relative">
                          <input 
                            type="text"
                            value={entryPrice}
                            onChange={(e) => {
                              setOrderType('LIMIT');
                              setEntryPrice(formatBalance(e.target.value));
                            }}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500/50 transition-all font-mono pr-24"
                          />
                          <button 
                            onClick={() => setOrderType(orderType === 'MARKET' ? 'LIMIT' : 'MARKET')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all"
                          >
                            <span className={`text-[8px] font-black uppercase ${orderType === 'MARKET' ? 'text-white' : 'text-blue-500'}`}>
                              {orderType === 'MARKET' ? (t as any).order_market : (t as any).order_limit}
                            </span>
                            <ArrowDown size={10} className={`text-white transition-transform duration-300 ${orderType === 'MARKET' ? '' : 'rotate-180'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-gray-500 uppercase font-black">{(t as any).leverage}</label>
                        <span className="text-[10px] text-white font-black">{leverage}x</span>
                      </div>
                      <div className="relative pt-2 pb-6">
                        <input 
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={leverage}
                          onChange={(e) => {
                            let val = parseInt(e.target.value);
                            // Snapping logic for multiples of 10
                            const snapThreshold = 3;
                            const snapPoints = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                            for (const point of snapPoints) {
                              if (Math.abs(val - point) <= snapThreshold) {
                                val = point;
                                break;
                              }
                            }
                            setLeverage(val);
                            setTradeAmount(formatBalance(Math.floor(simState.balance * val).toString()));
                          }}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer 
                            [&::-webkit-slider-thumb]:appearance-none 
                            [&::-webkit-slider-thumb]:w-4 
                            [&::-webkit-slider-thumb]:h-4 
                            [&::-webkit-slider-thumb]:rounded-full 
                            [&::-webkit-slider-thumb]:bg-black 
                            [&::-webkit-slider-thumb]:border-2 
                            [&::-webkit-slider-thumb]:border-zinc-600
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]
                            [&::-webkit-slider-thumb]:transition-all
                            hover:[&::-webkit-slider-thumb]:border-zinc-400"
                        />
                        {/* Ticks */}
                        <div className="absolute top-2 left-0 w-full flex justify-between px-0.5 pointer-events-none">
                          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                            <div key={val} className="flex flex-col items-center">
                              <div className="w-[1px] h-1.5 bg-white/20" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between px-1 -mt-4">
                        {[1, 10, 25, 50, 100].map(val => (
                          <button 
                            key={val}
                            onClick={() => {
                              setLeverage(val);
                              setTradeAmount(formatBalance(Math.floor(simState.balance * val).toString()));
                            }}
                            className={`text-[8px] font-black transition-colors ${leverage === val ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            {val}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Margin Info */}
                    <div className="flex flex-col gap-1 px-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-gray-500 uppercase font-black">{(t as any).margin}</span>
                        <span className="text-[9px] font-black font-mono text-gray-400">
                          ${formatSimValue(parseFloat(tradeAmount.replace(/\s/g, '')) / leverage || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleTrade('LONG')}
                        className="py-3 bg-[#00c853] hover:bg-[#00e676] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-900/40"
                      >
                        {t.buy_long}
                      </button>
                      <button 
                        onClick={() => handleTrade('SHORT')}
                        className="py-3 bg-[#ff1744] hover:bg-[#ff5252] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-900/40"
                      >
                        {t.sell_short}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center text-[10px] text-gray-500 uppercase font-black">
                    {t.select_asset_to_trade}
                  </div>
                )}

                {/* Pending Orders */}
                {simState.pendingOrders.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{(t as any).pending_orders}</span>
                      <span className="text-[10px] font-black text-white bg-zinc-900 px-3 py-0.5 rounded-full border border-zinc-700 shadow-inner">
                        {simState.pendingOrders.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {simState.pendingOrders.map(order => (
                        <div key={order.id} className="p-3 bg-black border border-white/10 rounded-xl flex flex-col gap-2 group hover:border-white/20 transition-all opacity-80">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${order.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {order.side} {order.leverage}x
                              </span>
                              <span className="text-[11px] font-black text-white">{order.symbol}</span>
                            </div>
                            <button 
                              onClick={() => simulatorService.cancelOrder(order.id)}
                              className="text-[9px] font-black text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded border border-red-600 transition-all uppercase tracking-tighter shadow-lg shadow-red-900/20"
                            >
                              {(t as any).cancel}
                            </button>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] text-gray-500 uppercase font-black">{(t as any).limit_price}</span>
                            <span className="text-[10px] font-bold text-blue-400 font-mono">${order.limitPrice.toLocaleString('ru-RU')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Positions */}
                {simState.positions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.open_positions}</span>
                      <span className="text-[10px] font-black text-white bg-zinc-900 px-3 py-0.5 rounded-full border border-zinc-700 shadow-inner">
                        {simState.positions.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {simState.positions.map(pos => {
                        const isLong = pos.side === 'LONG';
                        const currentPrice = (activeCoin && activeCoin.symbol === pos.symbol) ? activeCoin.price : pos.entryPrice;
                        const size = pos.amount * pos.leverage;
                        const pnl = isLong 
                          ? (currentPrice / pos.entryPrice - 1) * size 
                          : (1 - currentPrice / pos.entryPrice) * size;
                        const pnlPct = (pnl / pos.amount) * 100;
                        const isPositive = pnl >= 0;

                        const isTPValid = !pos.takeProfit || (isLong ? pos.takeProfit > currentPrice : pos.takeProfit < currentPrice);
                        const isSLValid = !pos.stopLoss || (isLong ? pos.stopLoss < currentPrice : pos.stopLoss > currentPrice);
                        const canConfirm = isTPValid && isSLValid;

                        return (
                          <div key={pos.id} className="p-3 bg-[#111111] border border-white/10 rounded-xl flex flex-col gap-2 group hover:border-white/20 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {pos.side} {pos.leverage}x
                                </span>
                                <span className="text-[11px] font-black text-white">{pos.symbol}</span>
                              </div>
                              <button 
                                onClick={() => handleClosePosition(pos)}
                                className="text-[9px] font-black text-black bg-white hover:bg-gray-200 px-2 py-1 rounded border border-white transition-all uppercase tracking-tighter"
                              >
                                {t.close}
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 uppercase font-black">{t.entry}</span>
                                <span className="text-[10px] font-bold text-gray-300 font-mono">${pos.entryPrice.toLocaleString('ru-RU')}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[8px] text-gray-500 uppercase font-black">{t.pnl}</span>
                                <span className={`text-[10px] font-black font-mono ${isPositive ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}>
                                  {isPositive ? '+' : ''}${formatSimValue(pnl)} ({pnlPct.toFixed(2)}%)
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-white/5">
                              <button 
                                onClick={() => setOpenTPSL(openTPSL === pos.id ? null : pos.id)}
                                className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
                              >
                                {openTPSL === pos.id ? <X size={10} /> : <TrendingUp size={10} />}
                                {openTPSL === pos.id ? t.close_settings : t.set_tp_sl}
                              </button>

                              {openTPSL === pos.id && (
                                <div className="flex flex-col gap-5 p-3 bg-[#0c0c0c] rounded-xl border border-zinc-800 mt-2 animate-in slide-in-from-top-2 duration-200">
                                  <div className="flex flex-col gap-2 border-b border-white/5 pb-2">
                                    <span className="text-[10px] font-black uppercase text-white tracking-widest">{t.tp_sl_settings}</span>
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col items-start">
                                        <span className="text-[7px] text-gray-500 uppercase">{t.entry_label}</span>
                                        <span className="text-[9px] font-bold text-gray-300 font-mono">${pos.entryPrice.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-[7px] text-gray-500 uppercase">{t.liq_label}</span>
                                        <span className="text-[9px] font-bold text-rose-500 font-mono">${pos.liquidationPrice.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Take Profit Section */}
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-emerald-500 uppercase font-black tracking-tighter">{t.tp_roi}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[7px] text-gray-500 uppercase">{t.trigger_price}</label>
                                        <div className="relative">
                                          <input 
                                            type="number"
                                            value={pos.takeProfit ? Number(pos.takeProfit.toFixed(2)) : ''}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              simulatorService.updatePositionTPSL(pos.id, isNaN(val) ? undefined : val, pos.stopLoss);
                                            }}
                                            className={`w-full bg-black border rounded-lg px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none transition-all ${!isTPValid ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-emerald-500/50'}`}
                                          />
                                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 font-bold uppercase">{t.market_label}</div>
                                        </div>
                                        {!isTPValid && (
                                          <span className="text-[6px] text-rose-500 font-bold uppercase mt-0.5">
                                            {isLong ? t.must_be_higher : t.must_be_lower}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[7px] text-gray-500 uppercase">{t.roi_label}</label>
                                        <div className="relative">
                                          <input 
                                            type="number"
                                            value={pos.takeProfit ? Number(((isLong ? (pos.takeProfit / pos.entryPrice - 1) : (1 - pos.takeProfit / pos.entryPrice)) * pos.leverage * 100).toFixed(1)) : ''}
                                            onChange={(e) => {
                                              const roi = parseFloat(e.target.value);
                                              if (isNaN(roi)) {
                                                simulatorService.updatePositionTPSL(pos.id, undefined, pos.stopLoss);
                                                return;
                                              }
                                              const priceChange = (roi / 100) / pos.leverage;
                                              const tpPrice = isLong ? pos.entryPrice * (1 + priceChange) : pos.entryPrice * (1 - priceChange);
                                              simulatorService.updatePositionTPSL(pos.id, tpPrice, pos.stopLoss);
                                            }}
                                            className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none focus:border-emerald-500/50"
                                          />
                                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 font-bold uppercase">%</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="relative pt-1 pb-4">
                                      <input 
                                        type="range"
                                        min="0"
                                        max="150"
                                        step="1"
                                        value={pos.takeProfit ? Math.min(150, Math.round((isLong ? (pos.takeProfit / pos.entryPrice - 1) : (1 - pos.takeProfit / pos.entryPrice)) * pos.leverage * 100)) : 0}
                                        onChange={(e) => {
                                          let val = parseInt(e.target.value);
                                          // Snapping logic
                                          const snapThreshold = 3;
                                          const snapPoints = [0, 10, 25, 50, 75, 100, 150];
                                          for (const point of snapPoints) {
                                            if (Math.abs(val - point) <= snapThreshold) {
                                              val = point;
                                              break;
                                            }
                                          }
                                          
                                          if (val === 0) {
                                            simulatorService.updatePositionTPSL(pos.id, undefined, pos.stopLoss);
                                            return;
                                          }
                                          const priceChange = (val / 100) / pos.leverage;
                                          const tpPrice = isLong ? pos.entryPrice * (1 + priceChange) : pos.entryPrice * (1 - priceChange);
                                          simulatorService.updatePositionTPSL(pos.id, tpPrice, pos.stopLoss);
                                        }}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer 
                                          [&::-webkit-slider-thumb]:appearance-none 
                                          [&::-webkit-slider-thumb]:w-4 
                                          [&::-webkit-slider-thumb]:h-4 
                                          [&::-webkit-slider-thumb]:rounded-full 
                                          [&::-webkit-slider-thumb]:bg-black 
                                          [&::-webkit-slider-thumb]:border-2 
                                          [&::-webkit-slider-thumb]:border-emerald-500/40
                                          [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]
                                          [&::-webkit-slider-thumb]:transition-all
                                          hover:[&::-webkit-slider-thumb]:border-emerald-400/60 relative z-10"
                                      />
                                      <div className="absolute top-1 left-0 w-full flex justify-between px-0.5 pointer-events-none">
                                        {[0, 10, 25, 50, 75, 100, 150].map(val => (
                                          <div key={val} className="flex flex-col items-center">
                                            <div className="w-[1px] h-1 bg-white/20" />
                                            <span className="text-[6px] text-gray-600 mt-1 font-bold">{val}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {pos.takeProfit && (
                                      <div className="text-[7px] text-gray-500 leading-tight">
                                        {t.tp_sl_explanation.replace('{price}', pos.takeProfit.toFixed(2))}
                                        <br />
                                        {t.estimated_pnl} <span className="text-emerald-500">+{formatSimValue((isLong ? (pos.takeProfit / pos.entryPrice - 1) : (1 - pos.takeProfit / pos.entryPrice)) * pos.amount * pos.leverage)} USDT (ROI {((isLong ? (pos.takeProfit / pos.entryPrice - 1) : (1 - pos.takeProfit / pos.entryPrice)) * pos.leverage * 100).toFixed(2)}%)</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Stop Loss Section */}
                                  <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-rose-500 uppercase font-black tracking-tighter">{t.sl_roi}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[7px] text-gray-500 uppercase">{t.trigger_price}</label>
                                        <div className="relative">
                                          <input 
                                            type="number"
                                            value={pos.stopLoss ? Number(pos.stopLoss.toFixed(2)) : ''}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              simulatorService.updatePositionTPSL(pos.id, pos.takeProfit, isNaN(val) ? undefined : val);
                                            }}
                                            className={`w-full bg-black border rounded-lg px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none transition-all ${!isSLValid ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-rose-500/50'}`}
                                          />
                                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 font-bold uppercase">{t.market_label}</div>
                                        </div>
                                        {!isSLValid && (
                                          <span className="text-[6px] text-rose-500 font-bold uppercase mt-0.5">
                                            {isLong ? t.must_be_lower : t.must_be_higher}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[7px] text-gray-500 uppercase">{t.roi_label}</label>
                                        <div className="relative">
                                          <input 
                                            type="number"
                                            value={pos.stopLoss ? Number(((isLong ? (pos.stopLoss / pos.entryPrice - 1) : (1 - pos.stopLoss / pos.entryPrice)) * pos.leverage * 100).toFixed(1)) : ''}
                                            onChange={(e) => {
                                              const roi = parseFloat(e.target.value);
                                              if (isNaN(roi)) {
                                                simulatorService.updatePositionTPSL(pos.id, pos.takeProfit, undefined);
                                                return;
                                              }
                                              const priceChange = (roi / 100) / pos.leverage;
                                              const slPrice = isLong ? pos.entryPrice * (1 + priceChange) : pos.entryPrice * (1 - priceChange);
                                              simulatorService.updatePositionTPSL(pos.id, pos.takeProfit, slPrice);
                                            }}
                                            className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white font-mono focus:outline-none focus:border-rose-500/50"
                                          />
                                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 font-bold uppercase">%</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="relative pt-1 pb-4">
                                      <input 
                                        type="range"
                                        min="0"
                                        max="75"
                                        step="1"
                                        value={pos.stopLoss ? Math.min(75, Math.abs(Math.round((isLong ? (pos.stopLoss / pos.entryPrice - 1) : (1 - pos.stopLoss / pos.entryPrice)) * pos.leverage * 100))) : 0}
                                        onChange={(e) => {
                                          let val = parseInt(e.target.value);
                                          // Snapping logic
                                          const snapThreshold = 3;
                                          const snapPoints = [0, 1, 10, 25, 50, 75];
                                          for (const point of snapPoints) {
                                            if (Math.abs(val - point) <= snapThreshold) {
                                              val = point;
                                              break;
                                            }
                                          }

                                          if (val === 0) {
                                            simulatorService.updatePositionTPSL(pos.id, pos.takeProfit, undefined);
                                            return;
                                          }
                                          // ROI is negative for stop loss
                                          const roi = -val;
                                          const priceChange = (roi / 100) / pos.leverage;
                                          const slPrice = isLong ? pos.entryPrice * (1 + priceChange) : pos.entryPrice * (1 - priceChange);
                                          simulatorService.updatePositionTPSL(pos.id, pos.takeProfit, slPrice);
                                        }}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer 
                                          [&::-webkit-slider-thumb]:appearance-none 
                                          [&::-webkit-slider-thumb]:w-4 
                                          [&::-webkit-slider-thumb]:h-4 
                                          [&::-webkit-slider-thumb]:rounded-full 
                                          [&::-webkit-slider-thumb]:bg-black 
                                          [&::-webkit-slider-thumb]:border-2 
                                          [&::-webkit-slider-thumb]:border-rose-500/40
                                          [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.5)]
                                          [&::-webkit-slider-thumb]:transition-all
                                          hover:[&::-webkit-slider-thumb]:border-rose-400/60 relative z-10"
                                      />
                                      <div className="absolute top-1 left-0 w-full flex justify-between px-0.5 pointer-events-none">
                                        {[0, 1, 10, 25, 50, 75].map(val => (
                                          <div key={val} className="flex flex-col items-center">
                                            <div className="w-[1px] h-1 bg-white/20" />
                                            <span className="text-[6px] text-gray-600 mt-1 font-bold">-{val}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {pos.stopLoss && (
                                      <div className="text-[7px] text-gray-500 leading-tight">
                                        {t.tp_sl_explanation.replace('{price}', pos.stopLoss.toFixed(2))}
                                        <br />
                                        {t.estimated_pnl} <span className="text-rose-500">{formatSimValue((isLong ? (pos.stopLoss / pos.entryPrice - 1) : (1 - pos.stopLoss / pos.entryPrice)) * pos.amount * pos.leverage)} USDT (ROI {((isLong ? (pos.stopLoss / pos.entryPrice - 1) : (1 - pos.stopLoss / pos.entryPrice)) * pos.leverage * 100).toFixed(2)}%)</span>
                                      </div>
                                    )}
                                  </div>

                                  <button 
                                    onClick={() => canConfirm && setOpenTPSL(null)}
                                    disabled={!canConfirm}
                                    className={`w-full py-2 text-black text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg ${canConfirm ? 'bg-white hover:bg-gray-200 shadow-white/10' : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
                                  >
                                    {canConfirm ? t.confirm : t.invalid_price}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Trade History */}
                {simState.history.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.trade_history}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {simState.history.map(trade => {
                        const isPositive = trade.pnl >= 0;
                        return (
                          <div key={trade.id} className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-black ${trade.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.side} {trade.leverage}x</span>
                                <span className="text-[10px] font-black text-gray-300">{trade.symbol}</span>
                              </div>
                              <span className="text-[8px] text-gray-500 font-mono">${trade.exitPrice.toLocaleString('ru-RU')}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`text-[10px] font-black font-mono ${isPositive ? 'text-[#00ff88]' : 'text-[#ff3355]'}`}>
                                {isPositive ? '+' : ''}${formatSimValue(trade.pnl)}
                              </span>
                              <span className="text-[8px] text-gray-600">{(trade.pnl / trade.amount * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div className="flex flex-col gap-4">
                {loadingNews ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2 animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-full" />
                      <div className="h-3 bg-white/5 rounded w-2/3" />
                    </div>
                  ))
                ) : (
                  news.map((item, i) => (
                    <a 
                      key={i} 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group flex flex-col gap-1 p-2 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                    >
                      <span className="text-xs font-medium text-gray-200 group-hover:text-purple-400 transition-colors leading-relaxed">
                        {item.title}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">{item.time}</span>
                        <ExternalLink size={10} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))
                )}
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="flex flex-col gap-4">
                {isAddingAlert ? (
                  <div className="p-4 bg-black rounded-xl border border-white/10 flex flex-col gap-4 animate-in fade-in zoom-in duration-200 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        {t.new_alert_title}
                      </span>
                      <button onClick={() => setIsAddingAlert(false)} className="text-rose-500 hover:text-rose-400">
                        <X size={14} />
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-gray-500 uppercase font-bold">{t.target_price} (USDT)</label>
                      <input 
                        type="number"
                        value={alertPrice}
                        onChange={(e) => setAlertPrice(e.target.value)}
                        placeholder={activeCoin?.price.toString()}
                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-gray-500 transition-all"
                      />
                    </div>

                    <button 
                      onClick={handleAddAlert}
                      disabled={!alertPrice}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                    >
                      {t.set_alert_btn}
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setIsAddingAlert(true);
                        if (activeCoin) setAlertPrice(activeCoin.price.toString());
                      }}
                      className="w-full py-3 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-white/30 transition-all group bg-white/5"
                    >
                      <Plus size={16} className="group-hover:text-purple-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t.create_alert}</span>
                    </button>

                    <div className="flex flex-col gap-2">
                      {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-600">
                            <Bell size={24} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-gray-300">{t.no_active_alerts}</span>
                            <span className="text-[10px] text-gray-500">{t.set_alerts_desc}</span>
                          </div>
                        </div>
                      ) : (
                        alerts.map((alert) => (
                          <div key={alert.id} className="p-3 bg-black rounded-xl border border-white/10 flex items-center justify-between group hover:border-white/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${alert.type === 'above' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {alert.type === 'above' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-white">{alert.symbol}</span>
                                <span className="text-[10px] text-gray-500">
                                  {alert.type === 'above' ? t.price_above : t.price_below} ${alert.price.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => onRemoveAlert(alert.id)}
                              className="p-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'charts' && (
              <div className="flex flex-col gap-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-200">{t.multi_chart_mode}</span>
                      <span className="text-[10px] text-gray-500">{t.add_chart_desc}</span>
                    </div>
                    <button 
                      onClick={() => setChartLayout(chartLayout > 1 ? 1 : 2)}
                      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${chartLayout > 1 ? 'bg-purple-600' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${chartLayout > 1 ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.add_chart}</span>
                    {loadingCoins && <RefreshCw size={10} className="animate-spin text-purple-400" />}
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      type="text"
                      value={coinSearchQuery}
                      onChange={(e) => setCoinSearchQuery(e.target.value)}
                      placeholder={t.search_placeholder || "Search coin..."}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {filteredCoins.map((coin) => (
                      <button
                        key={`${coin.exchange}:${coin.market}:${coin.symbol}`}
                        onClick={() => onSelectCoin(coin)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                            <img 
                              src={coin.logo} 
                              alt={coin.baseAsset}
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${coin.baseAsset}&background=random&color=fff`;
                              }}
                            />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black text-white">{coin.symbol}</span>
                            <span className="text-[8px] text-gray-500 uppercase">{coin.exchange} • {coin.market}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono text-gray-300">${coin.price.toLocaleString()}</span>
                          <span className={`text-[8px] font-bold ${coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                          </span>
                        </div>
                      </button>
                    ))}
                    {filteredCoins.length === 0 && !loadingCoins && (
                      <div className="py-8 text-center text-[10px] text-gray-500 uppercase tracking-widest">
                        No coins found
                      </div>
                    )}
                  </div>
                </div>

                {/* Drawing Tools Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.drawing_tools || 'Drawing Tools'}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
                    <button 
                      onClick={() => onToolChange(activeTool === 'brush' ? null : 'brush')}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${activeTool === 'brush' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.brush || 'Brush'}
                    >
                      <Brush size={16} />
                    </button>

                    <button 
                      onClick={() => onToolChange(activeTool === 'trendline' ? null : 'trendline')}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${activeTool === 'trendline' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.trend_line || 'Trend Line'}
                    >
                      <TrendingUp size={16} className="rotate-45" />
                    </button>

                    <button 
                      onClick={() => onToolChange(activeTool === 'hline' ? null : 'hline')}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${activeTool === 'hline' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.h_line || 'Horizontal Line'}
                    >
                      <div className="w-4 h-[1.5px] bg-current" />
                    </button>

                    <button 
                      onClick={() => onToolChange(activeTool === 'vline' ? null : 'vline')}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${activeTool === 'vline' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.v_line || 'Vertical Line'}
                    >
                      <div className="w-[1.5px] h-4 bg-current" />
                    </button>

                    <button 
                      onClick={() => onToolChange(activeTool === 'ruler' ? null : 'ruler')}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${activeTool === 'ruler' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.ruler || 'Ruler'}
                    >
                      <Ruler size={16} />
                    </button>

                    <button 
                      onClick={onToggleMagnet}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${magnetEnabled ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                      title={t.magnet || 'Magnet'}
                    >
                      <Magnet size={16} />
                    </button>

                    <button 
                      onClick={onUndo}
                      disabled={!canUndo}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${canUndo ? 'bg-black/20 border-white/5 text-gray-400 hover:text-white hover:border-white/20' : 'bg-black/10 border-white/5 text-gray-700 cursor-not-allowed'}`}
                      title={t.undo || 'Undo'}
                    >
                      <History size={16} className="scale-x-[-1]" />
                    </button>

                    <button 
                      onClick={onClearAll}
                      className="p-2.5 rounded-lg border border-white/5 bg-black/20 text-gray-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all flex items-center justify-center"
                      title={t.clear_all || 'Clear All'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Chart Layouts</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setChartLayout(1)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${chartLayout === 1 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      <div className="w-full h-8 border border-white/10 rounded bg-white/5" />
                      <span className={`text-[9px] font-bold ${chartLayout === 1 ? 'text-purple-400' : 'text-gray-500'}`}>{t.layout_single}</span>
                    </button>
                    <button 
                      onClick={() => setChartLayout(2)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${chartLayout === 2 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      <div className="w-full h-8 flex gap-1">
                        <div className="flex-1 border border-white/10 rounded bg-white/5" />
                        <div className="flex-1 border border-white/10 rounded bg-white/5" />
                      </div>
                      <span className={`text-[9px] font-bold ${chartLayout === 2 ? 'text-purple-400' : 'text-gray-500'}`}>{t.layout_dual}</span>
                    </button>
                    <button 
                      onClick={() => setChartLayout(3)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${chartLayout === 3 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      <div className="w-full h-8 flex gap-1">
                        <div className="flex-1 border border-white/10 rounded bg-white/5" />
                        <div className="flex-1 border border-white/10 rounded bg-white/5" />
                        <div className="flex-1 border border-white/10 rounded bg-white/5" />
                      </div>
                      <span className={`text-[9px] font-bold ${chartLayout === 3 ? 'text-purple-400' : 'text-gray-500'}`}>{t.layout_triple}</span>
                    </button>
                    <button 
                      onClick={() => setChartLayout(4)}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${chartLayout === 4 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}
                    >
                      <div className="w-full h-8 grid grid-cols-2 grid-rows-2 gap-1">
                        <div className="border border-white/10 rounded bg-white/5" />
                        <div className="border border-white/10 rounded bg-white/5" />
                        <div className="border border-white/10 rounded bg-white/5" />
                        <div className="border border-white/10 rounded bg-white/5" />
                      </div>
                      <span className={`text-[9px] font-bold ${chartLayout === 4 ? 'text-purple-400' : 'text-gray-500'}`}>{t.layout_quad}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fng' && (
              <div className="flex flex-col gap-6 items-center py-4">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-white/5"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * (fngData ? parseInt(fngData.value) : 0)) / 100}
                      className={`${fngData ? getFngColor(parseInt(fngData.value)) : 'text-gray-500'} transition-all duration-1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-black text-white">{fngData?.value || '--'}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${fngData ? getFngColor(parseInt(fngData.value)) : 'text-gray-500'}`}>
                      {fngData?.classification || 'Loading...'}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={14} className="text-purple-400" />
                    <span className="text-[11px] font-bold uppercase text-gray-300">{t.what_is_fng}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {t.fng_desc}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

