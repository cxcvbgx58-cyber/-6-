
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Table from './Table';
import MarketScreener, { FavoriteStar, CustomUndoIcon, CustomRedoIcon } from './MarketScreener';
import { AIBookModal } from './AIBookModal';
import { ExchangeLogo } from './UI/Shared';
import { BINANCE_ICON, BYBIT_ICON } from '../src/constants';

import { ChartBlock } from './ChartBlock';

const MemoTable = React.memo(Table);
const MemoMarketScreener = React.memo(MarketScreener);
import { RowData, SettingsState, ExchangeSelection, MarketType, ExchangeConfig, STORAGE_PREFIX, DEFAULT_SETTINGS, getConfigsForMarket, DBUser, MarketCoin } from '../models';
import { SmarteyeEngineService, CONFIG } from '../services/smarteye-engine.service';
import { User, Settings, ChevronDown, LayoutGrid, Check, Globe, RotateCcw, Star, Loader2, ChevronUp, BrainCircuit, ArrowUp, ArrowDown, BarChart2, Rewind, X, Maximize, Minimize, LogOut, Volume2 } from 'lucide-react';
import { Logo } from './UI/Icons';
import { Language, translations } from '../src/translations';
import { MarketSidebar } from './MarketSidebar';
import { SubscriptionAvatar } from './UI/SubscriptionAvatar';
import { SubscriptionPrompt } from './UI/SubscriptionPrompt';
import { apiService } from '../services/api.service';
import { simulatorService } from '../services/trading-simulator.service';
import { isCoinExcluded } from '../src/lib/filters';

import { LanguageSwitcher } from '../src/components/UI/LanguageSwitcher';

import confetti from 'canvas-confetti';

const Dashboard: React.FC<{ 
  onNavigateToProfile: (tab?: string, plan?: string) => void;
  onLogout: () => void;
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  engine: SmarteyeEngineService;
  avatarTier: 'free' | '1month' | '3months' | '1year';
  subscriptionTier: 'free' | 'pro' | 'whale';
  dbUser: DBUser | null;
  activeTab: 'screener' | 'market';
  setActiveTab: (tab: 'screener' | 'market') => void;
  refreshUser: () => Promise<void>;
  onAuthRequired?: () => void;
  showToast?: (message: string, type: any) => void;
}> = ({ onNavigateToProfile, onLogout, language, setLanguage, engine, avatarTier, subscriptionTier, dbUser, activeTab, setActiveTab, refreshUser, onAuthRequired, showToast }) => {
  const t = translations[language];
  const isInitializing = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitializing.current = false;
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const [isPortrait, setIsPortrait] = useState(typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : true);
  const [shortData, setShortData] = useState<RowData[]>([]);
  const [longData, setLongData] = useState<RowData[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, number>>({});
  
  // Shared state for MarketScreener, Header, and Sidebar
  const [previewCoin, setPreviewCoin] = useState<MarketCoin | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_activeCoin');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) { return null; }
      }
    }
    return null;
  });
  const [timeframe, setTimeframe] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('smarteye_timeframe') || '1m';
    }
    return '1m';
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_favorites');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showExtraTf, setShowExtraTf] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [chartLayout, setChartLayout] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_chartLayout');
      return saved ? Number(saved) : 1;
    }
    return 1;
  });
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1000);
  const [alerts, setAlerts] = useState<{ id: string; symbol: string; price: number; type: 'above' | 'below' }[]>([]);
  const [comparisonCoins, setComparisonCoins] = useState<MarketCoin[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_comparisonCoins');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [isCoinSelectorOpen, setIsCoinSelectorOpen] = useState(false);
  const [selectorSlotIndex, setSelectorSlotIndex] = useState<number | null>(null);
  const [drawings, setDrawings] = useState<Record<string, any[]>>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_drawings');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [activeExchanges, setActiveExchanges] = useState<Record<string, boolean>>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_activeExchanges');
      return saved ? JSON.parse(saved) : { 'Binance': true, 'Bybit': true };
    }
    return { 'Binance': true, 'Bybit': true };
  });
  const [activeTypes, setActiveTypes] = useState<Record<string, boolean>>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_activeTypes');
      return saved ? JSON.parse(saved) : { 'SPOT': true, 'FUTURES': true };
    }
    return { 'SPOT': true, 'FUTURES': true };
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('smarteye_viewMode') as 'list' | 'grid') || 'list';
    }
    return 'list';
  });
  const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' }>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_sortConfig');
      return saved ? JSON.parse(saved) : { key: 'none', dir: 'desc' };
    }
    return { key: 'none', dir: 'desc' };
  });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [selectedExchanges, setSelectedExchanges] = useState<ExchangeSelection>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('smarteye_selectedExchanges');
      return saved ? JSON.parse(saved) : { 
        'Binance Spot': true, 'Binance Futures': true, 'Bybit Spot': true, 'Bybit Futures': true
      };
    }
    return { 'Binance Spot': true, 'Binance Futures': true, 'Bybit Spot': true, 'Bybit Futures': true };
  });

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [showTrialNotification, setShowTrialNotification] = useState(false);
  const [trialTimeLeft, setTrialTimeLeft] = useState<number | null>(null);
  const trialStartedRef = useRef(false);

  // Trial logic for registered users
  useEffect(() => {
    if (dbUser && (dbUser.subscription_tier === 'free' || !dbUser.subscription_tier)) {
      const now = Date.now();
      const createdAt = new Date(dbUser.created_at).getTime();
      const trialDuration = 60 * 1000; // 1 minute
      const elapsed = now - createdAt;

      if (elapsed < trialDuration) {
        const remaining = Math.ceil((trialDuration - elapsed) / 1000);
        setTrialTimeLeft(remaining);
        if (!trialStartedRef.current) {
          setShowTrialNotification(true);
          setTimeout(() => setShowTrialNotification(false), 5000);
          showToast?.(language === 'ru' ? 'Вам предоставлен пробный период 1 минута' : 'You have been granted a 1-minute trial period', 'info');
          trialStartedRef.current = true;
        }
      } else {
        setTrialTimeLeft(0);
      }
    } else {
      setTrialTimeLeft(null);
      trialStartedRef.current = false;
    }
  }, [dbUser, language, showToast]);

  useEffect(() => {
    if (trialTimeLeft !== null && trialTimeLeft > 0 && dbUser) {
      const timer = setInterval(() => {
        setTrialTimeLeft(prev => {
          if (prev && prev <= 1) {
            clearInterval(timer);
            showToast?.(language === 'ru' ? 'Пробный период окончен. Оформите подписку для продолжения.' : 'Trial period ended. Please subscribe to continue.', 'info');
            return 0;
          }
          return prev ? prev - 1 : 0;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [trialTimeLeft, dbUser, language, showToast]);

  const isRestricted = useMemo(() => {
    if (!dbUser) return false;
    // If user has a trial period active, they are not restricted
    if (trialTimeLeft !== null && trialTimeLeft > 0) return false;
    return dbUser.subscription_tier === 'free' || !dbUser.subscription_tier;
  }, [dbUser, trialTimeLeft]);

  const checkAuth = useCallback(() => {
    if (!dbUser) {
      onAuthRequired?.();
      return false;
    }
    return true;
  }, [dbUser, onAuthRequired]);

  const checkSubscription = (featureName: string) => {
    if (!checkAuth()) return false;
    
    // If user has a subscription (pro or whale), allow everything
    if (dbUser && dbUser.subscription_tier && dbUser.subscription_tier !== 'free') {
      return true;
    }

    // Allow usage during trial period for registered users
    if (trialTimeLeft !== null && trialTimeLeft > 0) {
      return true;
    }

    // Restricted features for free users
    const restrictedFeatures = [
      'Densities', 
      'API Analysis', 
      'AI Analysis',
      'Charts', 
      'Multi-Charts', 
      'Notifications', 
      'Simulator',
      'News',
      'FnG'
    ];
    
    if (restrictedFeatures.includes(featureName)) {
      setShowSubscriptionPrompt(true);
      return false;
    }

    return true;
  };

  const [spotSettings, setSpotSettings] = useState<SettingsState>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PREFIX + 'spot') : null;
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
  });
  const [futuresSettings, setFuturesSettings] = useState<SettingsState>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PREFIX + 'futures') : null;
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastDensityIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Preload notification sound
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playAlert = useCallback((volume: number = 0.5) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  useEffect(() => {
    if (isInitializing.current) return;

    const allDensities = [...longData, ...shortData];
    let shouldPlay = false;
    let playVolume = 0.5;

    for (const d of allDensities) {
      if (!lastDensityIds.current.has(d.id)) {
        // New density detected
        const marketType = d.market as MarketType;
        const settings = marketType === 'SPOT' ? spotSettings : futuresSettings;
        if (settings.soundAlertEnabled) {
          shouldPlay = true;
          playVolume = settings.soundAlertVolume ?? 0.5;
          break;
        }
      }
    }

    // Update tracked IDs
    lastDensityIds.current = new Set(allDensities.map(d => d.id));

    if (shouldPlay) {
      playAlert(playVolume);
    }
  }, [longData, shortData, spotSettings, futuresSettings, playAlert]);

  // Load DB data
  useEffect(() => {
    const init = async () => {
      setIsSettingsLoaded(false);
      try {
        if (dbUser) {
          loadAlerts();
          await loadSettings();
          simulatorService.setUserId(dbUser.id, dbUser.balance);
        } else {
          // When not logged in, we already loaded from localStorage via initializers
          simulatorService.setUserId(null);
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setIsSettingsLoaded(true);
      }
    };
    init();
  }, [dbUser]);

  const loadAlerts = async () => {
    if (!dbUser) return;
    try {
      const dbAlerts = await apiService.getAlerts(dbUser.id);
      setAlerts(dbAlerts.map(a => ({
        id: a.id,
        symbol: a.symbol,
        price: Number(a.price),
        type: a.type
      })));
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const loadSettings = async () => {
    if (!dbUser) return;
    try {
      const settings = await apiService.getSettings(dbUser.id) as any;
      if (settings) {
        if (settings.spotSettings) setSpotSettings({ ...DEFAULT_SETTINGS, ...settings.spotSettings });
        if (settings.futuresSettings) setFuturesSettings({ ...DEFAULT_SETTINGS, ...settings.futuresSettings });
        
        if (settings.activeCoin) {
          setPreviewCoin(settings.activeCoin);
        } else {
          // If no active coin in DB (new user), clear preview coin so screener picks the top one
          setPreviewCoin(null);
          localStorage.removeItem('smarteye_activeCoin');
        }

        if (settings.timeframe) setTimeframe(settings.timeframe);
        if (settings.favorites) setFavorites(settings.favorites);
        if (settings.drawings) setDrawings(settings.drawings);
        if (settings.activeExchanges) setActiveExchanges(settings.activeExchanges);
        if (settings.activeTypes) setActiveTypes(settings.activeTypes);
        if (settings.viewMode) setViewMode(settings.viewMode as 'list' | 'grid');
        if (settings.sortConfig) setSortConfig(settings.sortConfig as any);
        if (settings.comparisonCoins) setComparisonCoins(settings.comparisonCoins);
        if (settings.chartLayout) setChartLayout(settings.chartLayout);
        if (settings.selectedExchanges) setSelectedExchanges(settings.selectedExchanges);
      } else {
        // No settings at all (fresh registration)
        setPreviewCoin(null);
        localStorage.removeItem('smarteye_activeCoin');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveCurrentSettings = async (updates: Partial<SettingsState>) => {
    if (!dbUser) return;
    try {
      const current = await apiService.getSettings(dbUser.id) || DEFAULT_SETTINGS;
      await apiService.saveSettings(dbUser.id, { ...current, ...updates });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Auto-save favorites
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (dbUser && favorites.length > 0) {
      saveCurrentSettings({ favorites });
    } else {
      localStorage.setItem('smarteye_favorites', JSON.stringify(favorites));
    }
  }, [favorites, dbUser, isSettingsLoaded]);

  // Auto-save active coin and timeframe
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (previewCoin) {
      localStorage.setItem('smarteye_activeCoin', JSON.stringify(previewCoin));
      localStorage.setItem('smarteye_timeframe', timeframe);
      
      if (dbUser) {
        saveCurrentSettings({ activeCoin: previewCoin, timeframe });
      }
    }
  }, [previewCoin, timeframe, dbUser, isSettingsLoaded]);

  // Auto-save filters
  useEffect(() => {
    if (!isSettingsLoaded) return;
    if (dbUser) {
      saveCurrentSettings({ 
        activeExchanges, 
        activeTypes, 
        viewMode, 
        sortConfig,
        comparisonCoins,
        chartLayout,
        selectedExchanges
      });
    } else {
      localStorage.setItem('smarteye_activeExchanges', JSON.stringify(activeExchanges));
      localStorage.setItem('smarteye_activeTypes', JSON.stringify(activeTypes));
      localStorage.setItem('smarteye_viewMode', viewMode);
      localStorage.setItem('smarteye_sortConfig', JSON.stringify(sortConfig));
      localStorage.setItem('smarteye_comparisonCoins', JSON.stringify(comparisonCoins));
      localStorage.setItem('smarteye_chartLayout', chartLayout.toString());
      localStorage.setItem('smarteye_selectedExchanges', JSON.stringify(selectedExchanges));
    }
  }, [activeExchanges, activeTypes, viewMode, sortConfig, comparisonCoins, chartLayout, selectedExchanges, dbUser, isSettingsLoaded]);

  const onDrawingsChange = (symbol: string, symbolDrawings: any[]) => {
    setDrawings(prev => {
      const next = { ...prev, [symbol]: symbolDrawings };
      if (dbUser) {
        saveCurrentSettings({ drawings: next });
      } else {
        localStorage.setItem('smarteye_drawings', JSON.stringify(next));
      }
      return next;
    });
  };

  const onAddAlert = async (alert: { symbol: string; price: number; type: 'above' | 'below' }) => {
    if (!dbUser) {
      const newAlert = { ...alert, id: Math.random().toString(36).substr(2, 9) };
      setAlerts(prev => [newAlert, ...prev]);
      return;
    }

    try {
      const created = await apiService.createAlert({
        user_id: dbUser.id,
        symbol: alert.symbol,
        price: alert.price,
        type: alert.type
      });
      setAlerts(prev => [{
        id: created.id,
        symbol: created.symbol,
        price: Number(created.price),
        type: created.type
      }, ...prev]);
    } catch (error) {
      console.error('Failed to save alert:', error);
    }
  };

  const onRemoveAlert = async (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    if (dbUser) {
      try {
        await apiService.deleteAlert(id);
      } catch (error) {
        console.error('Failed to delete alert:', error);
      }
    }
  };
  
  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);
  
  const miniChartRef = useRef<any>(null);
  const tfDropdownRef = useRef<HTMLDivElement>(null);

  const onUndo = () => miniChartRef.current?.undo?.();
  const onRedo = () => miniChartRef.current?.redo?.();
  const onClearAll = () => miniChartRef.current?.clearAll?.();
  const onToggleMagnet = () => setMagnetEnabled(prev => !prev);

  const MAIN_TIMEFRAMES = ['1m', '15m', '1h'];
  const EXTRA_TIMEFRAMES = [
    { label: language === 'ru' ? 'Минуты' : 'Minutes', items: ['1m', '3m', '5m', '15m', '30m'] },
    { label: language === 'ru' ? 'Часы' : 'Hours', items: ['1h', '2h', '4h', '6h', '12h'] },
    { label: language === 'ru' ? 'Дни/Недели' : 'Days/Weeks', items: ['1d', '1w'] }
  ];

  useEffect(() => {
    localStorage.setItem('smarteye_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (previewCoin) {
      setPriceFlash(true);
      const timer = setTimeout(() => setPriceFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [previewCoin?.price]);

  const toggleFavorite = (e: React.MouseEvent, coin: MarketCoin) => {
    e.stopPropagation();
    if (!checkAuth()) return;
    const key = `${coin.exchange}:${coin.market}:${coin.symbol}`;
    setFavorites(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isFavorite = (coin: MarketCoin) => {
    return favorites.includes(`${coin.exchange}:${coin.market}:${coin.symbol}`);
  };
  
  const [isExchangeDropdownOpen, setIsExchangeDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [aiBookCoin, setAiBookCoin] = useState<any>(null);
  const [isAiBookOpen, setIsAiBookOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const exchangeDropdownRef = useRef<HTMLDivElement>(null);

  // Scroll to top on tab change
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const spotSettingsRef = useRef(spotSettings);
  const futuresSettingsRef = useRef(futuresSettings);

  useEffect(() => {
    spotSettingsRef.current = spotSettings;
    if (isSettingsLoaded && dbUser) {
      saveCurrentSettings({ spotSettings: spotSettings as any });
    } else {
      localStorage.setItem(STORAGE_PREFIX + 'spot', JSON.stringify(spotSettings));
    }
  }, [spotSettings, dbUser, isSettingsLoaded]);

  useEffect(() => {
    futuresSettingsRef.current = futuresSettings;
    if (isSettingsLoaded && dbUser) {
      saveCurrentSettings({ futuresSettings: futuresSettings as any });
    } else {
      localStorage.setItem(STORAGE_PREFIX + 'futures', JSON.stringify(futuresSettings));
    }
  }, [futuresSettings, dbUser, isSettingsLoaded]);

  useEffect(() => {
    const fetchRanks = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false');
        if (response.ok) {
          const data = await response.json();
          const mapping: Record<string, number> = {};
          data.forEach((coin: any) => {
            mapping[coin.symbol.toUpperCase()] = coin.market_cap_rank;
          });
          setRankMap(mapping);
          engine.setRankMap(mapping);
        }
      } catch (error) {
        console.error('Error fetching ranks:', error);
      }
    };
    fetchRanks();
  }, [engine]);

  useEffect(() => {
    const subL = engine.longs$.subscribe(data => {
      setLongData(data.filter(d => !isCoinExcluded(d)));
    });
    const subS = engine.shorts$.subscribe(data => {
      setShortData(data.filter(d => !isCoinExcluded(d)));
    });
    engine.startPipeline(CONFIG.engineTickMs, (t) => t === 'SPOT' ? spotSettingsRef.current : futuresSettingsRef.current);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (exchangeDropdownRef.current && !exchangeDropdownRef.current.contains(event.target as Node)) {
        setIsExchangeDropdownOpen(false);
      }
      if (tfDropdownRef.current && !tfDropdownRef.current.contains(event.target as Node)) {
        setShowExtraTf(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);

    return () => { 
      subL.unsubscribe(); subS.unsubscribe(); engine.stopPipeline(); engine.disconnectAll();
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [engine]);

  useEffect(() => {
    const configs: ExchangeConfig[] = [];
    if (selectedExchanges['Binance Spot']) configs.push(...getConfigsForMarket('SPOT', 'Binance'));
    if (selectedExchanges['Binance Futures']) configs.push(...getConfigsForMarket('FUTURES', 'Binance'));
    if (selectedExchanges['Bybit Spot']) configs.push(...getConfigsForMarket('SPOT', 'Bybit'));
    if (selectedExchanges['Bybit Futures']) configs.push(...getConfigsForMarket('FUTURES', 'Bybit'));
    engine.connectExchanges(configs);
  }, [selectedExchanges, engine]);

  const toggleExchange = (key: string) => setSelectedExchanges(prev => ({...prev, [key]: !prev[key]}));

  const handleInputChange = (type: MarketType, key: keyof SettingsState | 'test', val: any) => {
    if (key === 'test') {
      const settings = type === 'SPOT' ? spotSettings : futuresSettings;
      playAlert(settings.soundAlertVolume ?? 0.5);
      return;
    }
    const settingsKey = key as keyof SettingsState;
    if (type === 'SPOT') setSpotSettings(p => ({...p, [settingsKey]: val}));
    else setFuturesSettings(p => ({...p, [settingsKey]: val}));
  };

  const resetToDefault = (type: MarketType) => {
    if (type === 'SPOT') setSpotSettings({ ...DEFAULT_SETTINGS });
    else setFuturesSettings({ ...DEFAULT_SETTINGS });
  };

  const exchangeList = [
    { key: 'Binance Spot', name: 'Binance', sub: 'СПОТ', logo: BINANCE_ICON },
    { key: 'Binance Futures', name: 'Binance', sub: 'ФЬЮЧЕРС', logo: BINANCE_ICON },
    { key: 'Bybit Spot', name: 'Bybit', sub: 'СПОТ', logo: BYBIT_ICON },
    { key: 'Bybit Futures', name: 'Bybit', sub: 'ФЬЮЧЕРС', logo: BYBIT_ICON },
  ];

  const handleSetPreviewCoin = useCallback((action: React.SetStateAction<MarketCoin | null>) => {
    if (typeof action === 'function') {
      setPreviewCoin(action);
    } else if (action) {
      const isSameCoin = previewCoin && 
        action.symbol === previewCoin.symbol && 
        action.exchange === previewCoin.exchange && 
        action.market === previewCoin.market;
      
      const isInitialLoad = !previewCoin;
      
      // Allow switching coins for preview/browsing even without auth
      // Feature-level restrictions are handled separately
      if (isInitializing.current || isSameCoin || isInitialLoad || dbUser || true) {
        setPreviewCoin(action);
        
        // Scroll to top when changing coin from the dashboard (e.g., from Densities table)
        if (!isInitialLoad && !isSameCoin) {
          setTimeout(() => {
            const header = document.getElementById('app-header');
            if (header) {
              header.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 50);
        }
      }
    } else {
      setPreviewCoin(null);
    }
  }, [previewCoin, dbUser]);

  return (
    <div className="h-full w-full bg-black text-white p-0 flex flex-col overflow-hidden relative">
      <div id="app-header" className={`sticky top-0 z-[10000] flex flex-col shrink-0 border-b border-white/10 ${isFullscreen || isAiBookOpen ? 'hidden md:flex' : ''}`}>
        {/* TOP ROW: LOGO + MAIN NAV + TOOLS */}
        <div className="flex justify-between items-center h-11 md:h-14 bg-black pl-1 pr-1 md:px-2 border-b border-white/5">
          <div className="flex items-center gap-1 md:gap-1">
            <div className="flex items-center gap-1 md:gap-1.5 group cursor-default">
              <div className="hidden md:block">
                <Logo size="md" textBreakpoint="xl" />
              </div>
              <div className="md:hidden">
                <Logo size="sm" />
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex flex-1 justify-start ml-2 lg:ml-4 xl:ml-8">
            <div className="flex items-center bg-white/[0.05] p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => {
                    if (checkSubscription('Charts')) {
                      setActiveTab('market');
                    }
                  }} 
                  className={`flex items-center gap-2 px-3 xl:px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'market' 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/20' 
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                  }`}
                >
                  <Globe size={14} /> <span>{t.market}</span>
                </button>
                <button 
                  onClick={() => {
                    if (checkSubscription('Densities')) {
                      setActiveTab('screener');
                    }
                  }} 
                  className={`flex items-center gap-2 px-3 xl:px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'screener' 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/20' 
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                  }`}
                >
                  <LayoutGrid size={14} /> <span>{t.densities}</span>
                </button>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-3 sm:gap-2">
            <div className="relative" ref={exchangeDropdownRef}>
              <button 
                onClick={() => setIsExchangeDropdownOpen(!isExchangeDropdownOpen)} 
                className={`text-[10px] sm:text-[11px] uppercase tracking-[0.1em] font-black px-2 sm:px-2 py-1.5 sm:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 sm:gap-2 group ${
                  isExchangeDropdownOpen 
                  ? 'bg-black border-zinc-500/60 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-zinc-500/30 hover:bg-black hover:text-gray-300'
                }`}
              >
                <span className="hidden lg:inline">{t.exchanges}</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-mono text-xs sm:text-sm">[</span>
                  <div className="flex gap-1">
                    {(() => {
                      const hasBinance = selectedExchanges['Binance Spot'] || selectedExchanges['Binance Futures'];
                      const hasBybit = selectedExchanges['Bybit Spot'] || selectedExchanges['Bybit Futures'];
                      const icons = [];
                      if (hasBinance) icons.push({ id: 'binance', src: BINANCE_ICON, isBybit: false });
                      if (hasBybit) icons.push({ id: 'bybit', src: BYBIT_ICON, isBybit: true });
                      
                      return icons.map(icon => (
                        <div key={icon.id} className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border border-white/10 bg-[#111] flex items-center justify-center overflow-hidden shadow-sm">
                          <img 
                            src={icon.src} 
                            className={`w-full h-full object-contain ${icon.isBybit ? 'scale-[1.6] px-0.5' : 'p-0.5'}`} 
                            alt="" 
                          />
                        </div>
                      ));
                    })()}
                  </div>
                  <span className="text-gray-400 font-mono text-xs sm:text-sm">]</span>
                </div>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isExchangeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExchangeDropdownOpen && (
                <div className="absolute top-full right-0 mt-3 bg-[#0a0a0a]/95 border border-zinc-500/30 p-2.5 sm:p-3 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] z-[10001] w-64 sm:w-72 max-w-[calc(100vw-1rem)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-3 duration-300">
                  <div className="space-y-1.5 sm:space-y-2">
                    {exchangeList.map(ex => (
                      <div 
                        key={ex.key} 
                        onClick={() => toggleExchange(ex.key)}
                        className={`flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border cursor-pointer transition-all group ${
                          selectedExchanges[ex.key] 
                          ? 'bg-black border-zinc-500/60 shadow-[0_0_10px_rgba(255,255,255,0.05)]' 
                          : 'bg-black/40 border-white/5 hover:border-zinc-500/30 hover:bg-black'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <ExchangeLogo exchange={ex.name as 'Binance' | 'Bybit'} size="w-10 h-6" />
                            <div className="flex flex-col leading-tight">
                              <span className={`text-[13px] font-bold tracking-tight ${selectedExchanges[ex.key] ? 'text-white' : 'text-gray-400'}`}>{ex.name}</span>
                              <span className={`text-[8px] font-black uppercase tracking-[0.2em] leading-none ${selectedExchanges[ex.key] ? 'text-white' : 'text-white/40'}`}>{ex.sub}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          selectedExchanges[ex.key] 
                          ? 'bg-zinc-800 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                          : 'bg-white/5 border border-white/10'
                        }`}>
                          {selectedExchanges[ex.key] && <Check size={14} className="text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <LanguageSwitcher language={language} setLanguage={setLanguage} />

            {/* TIMEFRAME SELECTOR - ONLY SHOW WHEN MULTIPLE CHARTS ARE ACTIVE */}
            {(chartLayout > 1 || comparisonCoins.length > 0) && (
              <div className="flex items-center bg-[#151515] p-0.5 md:p-1 rounded-xl border border-white/10 shadow-xl">
                <div className="hidden sm:flex items-center">
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
                </div>
                <div className="relative" ref={tfDropdownRef}>
                  <button 
                    onClick={() => setShowExtraTf(!showExtraTf)}
                    className={`w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center transition-all ${
                      EXTRA_TIMEFRAMES.some(s => s.items.includes(timeframe)) && !MAIN_TIMEFRAMES.includes(timeframe)
                      ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-1 px-1">
                      <span className="sm:hidden text-[10px] font-black font-mono text-white/70">{timeframe}</span>
                      <ChevronDown size={14} className={`transition-transform duration-300 ${showExtraTf ? 'rotate-180' : ''}`} />
                    </div>
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

            <button 
              onClick={() => onNavigateToProfile()} 
              className="hidden md:flex items-center gap-1.5 lg:gap-2.5 pl-1.5 lg:pl-3 pr-1 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group"
            >
              <div className="hidden lg:flex flex-col items-end leading-none">
                <span className="text-[10px] font-black text-white uppercase tracking-wider">{t.profile}</span>
              </div>
              <div className="p-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full group-hover:bg-purple-500/20 transition-all">
                <SubscriptionAvatar tier={avatarTier} size={28} />
              </div>
            </button>
          </div>
        </div>

        {/* BOTTOM ROW: TERMINAL CONTROLS (UNIFIED) */}
      </div>
      
      <div className={`flex-1 min-h-0 overflow-hidden bg-[#050505] relative pb-16 md:pb-0 flex flex-row ${isAiBookOpen ? 'hidden md:flex' : ''}`}>
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'market' ? (
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 relative ${
              isFullscreen ? 'fixed inset-0 z-[4000] bg-black' : ''
            }`}>
              <ChartBlock 
                previewCoin={previewCoin}
                language={language}
                t={t}
                isPortrait={isPortrait}
                isReplayMode={isReplayMode}
                setIsReplayMode={setIsReplayMode}
                setIsAiBookOpen={setIsAiBookOpen}
                setAiBookCoin={setAiBookCoin}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                historyState={historyState}
                miniChartRef={miniChartRef}
                showExtraTf={showExtraTf}
                setShowExtraTf={setShowExtraTf}
                tfDropdownRef={tfDropdownRef}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                isFullscreen={isFullscreen}
                chartLayout={chartLayout}
                comparisonCoins={comparisonCoins}
                checkSubscription={checkSubscription}
              />
              <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 bg-[#0a0a0a] relative ${
                isFullscreen ? 'h-full w-full rounded-none border-none' : ''
              }`}>
                {/* MARKET SCREENER - HANDLES CHART, CONTROLS AND ITS OWN SCROLLABLE LIST */}
                <MemoMarketScreener 
                  language={language} 
                  previewCoin={previewCoin}
                  setPreviewCoin={handleSetPreviewCoin}
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                  miniChartRef={miniChartRef}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  rankMap={rankMap}
                  onHistoryChange={setHistoryState}
                  onOpenAI={(coin) => {
                    if (checkSubscription('API Analysis')) {
                      setAiBookCoin(coin);
                      setIsAiBookOpen(true);
                    }
                  }}
                  isAiModalOpen={isAiBookOpen}
                  chartLayout={chartLayout}
                  setChartLayout={setChartLayout}
                  isReplayMode={isReplayMode}
                  setIsReplayMode={setIsReplayMode}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  replaySpeed={replaySpeed}
                  setReplaySpeed={setReplaySpeed}
                  comparisonCoins={comparisonCoins}
                  setComparisonCoins={setComparisonCoins}
                  alerts={alerts}
                  setAlerts={setAlerts}
                  engine={engine}
                  isFullscreen={isFullscreen}
                  setIsFullscreen={setIsFullscreen}
                  isSettingsLoaded={isSettingsLoaded}
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  magnetEnabled={magnetEnabled}
                  onMagnetChange={onToggleMagnet}
                  isCoinSelectorOpen={isCoinSelectorOpen}
                  setIsCoinSelectorOpen={setIsCoinSelectorOpen}
                  selectorSlotIndex={selectorSlotIndex}
                  setSelectorSlotIndex={setSelectorSlotIndex}
                  drawings={drawings}
                  onDrawingsChange={onDrawingsChange}
                  activeExchanges={activeExchanges}
                  setActiveExchanges={setActiveExchanges}
                  activeTypes={activeTypes}
                  setActiveTypes={setActiveTypes}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  checkSubscription={checkSubscription}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* COINS BLOCK - SCROLLABLE */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-[#0a0a0a] relative custom-scroll scroll-smooth flex flex-col">
                <MemoTable 
                  shortData={shortData} 
                  longData={longData} 
                  language={language} 
                  onOpenAI={(coin) => {
                    if (checkSubscription('API Analysis')) {
                      setAiBookCoin(coin);
                      setIsAiBookOpen(true);
                    }
                  }}
                  spotSettings={spotSettings}
                  futuresSettings={futuresSettings}
                  onSettingChange={handleInputChange}
                  onResetSettings={resetToDefault}
                  isBlurred={isRestricted}
                />
              </div>
            </div>
          )}
        </div>

        {activeTab === 'market' && (
          <MarketSidebar 
            language={language} 
            chartLayout={chartLayout}
            setChartLayout={setChartLayout}
            alerts={alerts}
            onAddAlert={onAddAlert}
            onRemoveAlert={onRemoveAlert}
            activeCoin={previewCoin}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
            onSelectCoin={(coin) => {
              setComparisonCoins(prev => {
                // Check if already in list
                const exists = prev.some(c => c.symbol === coin.symbol && c.exchange === coin.exchange && c.market === coin.market);
                if (exists) return prev;
                
                const newList = [...prev, coin].slice(0, 3); // Max 3 comparison coins (total 4 charts)
                setChartLayout(newList.length + 1);
                return newList;
              });
            }}
            comparisonCoins={comparisonCoins}
            replayState={{ isReplayMode, isPlaying, replaySpeed }}
            onToggleReplayMode={() => {
              if (checkSubscription('Simulator')) {
                setIsReplayMode(!isReplayMode);
              }
            }}
            onTogglePlayPause={() => {
              if (checkSubscription('Simulator')) {
                setIsPlaying(!isPlaying);
              }
            }}
            onSetReplaySpeed={setReplaySpeed}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={onUndo}
            onRedo={onRedo}
            onClearAll={onClearAll}
            magnetEnabled={magnetEnabled}
            onToggleMagnet={onToggleMagnet}
            canUndo={historyState.canUndo}
            canRedo={historyState.canRedo}
            onOpenCoinSelector={() => {
              setSelectorSlotIndex(-1);
              setIsCoinSelectorOpen(true);
            }}
            checkSubscription={checkSubscription}
          />
        )}
      </div>

      {isAiBookOpen && aiBookCoin && (
        <AIBookModal 
          coin={aiBookCoin} 
          language={language}
          onClose={() => {
            setIsAiBookOpen(false);
            setAiBookCoin(null);
          }} 
        />
      )}

      {/* Mobile Bottom Navigation */}
      {!isFullscreen && !isAiBookOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-12 bg-black/40 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 z-[20000] pb-safe">
          <button 
            onClick={() => {
              if (checkSubscription('Charts')) {
                setActiveTab('market');
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 transition-all ${
              activeTab === 'market' ? 'text-purple-400' : 'text-gray-500'
            }`}
          >
            <Globe size={18} className={activeTab === 'market' ? 'scale-110' : ''} />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t.market}</span>
          </button>

          <button 
            onClick={() => {
              if (checkSubscription('Densities')) {
                setActiveTab('screener');
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 transition-all ${
              activeTab === 'screener' ? 'text-purple-400' : 'text-gray-500'
            }`}
          >
            <LayoutGrid size={18} className={activeTab === 'screener' ? 'scale-110' : ''} />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t.densities}</span>
          </button>

          <button 
            className="flex flex-col items-center justify-center gap-0.5 w-16 text-gray-500 hover:text-white transition-colors"
            onClick={() => setIsMobileSettingsOpen(true)}
          >
            <Settings size={18} />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t.settings}</span>
          </button>

          <button 
            className="flex flex-col items-center justify-center gap-0.5 w-16 text-gray-500 hover:text-white transition-colors"
            onClick={() => onNavigateToProfile()}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10">
              <SubscriptionAvatar tier={avatarTier} size={24} />
            </div>
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t.profile}</span>
          </button>
        </div>
      )}

      {/* Floating Trial Notification */}
      {dbUser && trialTimeLeft !== null && trialTimeLeft > 0 && showTrialNotification && (
        <div className="fixed top-6 left-6 md:top-8 md:left-8 z-[100000] animate-in slide-in-from-top-10 fade-in duration-500">
          <div className="bg-[#0d0d0d] border border-green-500/50 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(34,197,94,0.1)] backdrop-blur-xl">
            {/* Green Checkmark Icon */}
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 shrink-0">
              <Check size={20} className="text-green-500" strokeWidth={3} />
            </div>

            {/* Text */}
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight leading-tight">
                {language === 'ru' ? 'Выдан пробный период' : 'Trial period granted'}
              </span>
              <span className="text-sm font-medium text-white/70 mt-0.5">
                {language === 'ru' ? 'на 1 минуту' : 'for 1 minute'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Settings Modal */}
      {isMobileSettingsOpen && (
        <div className="md:hidden fixed inset-0 z-[30000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <Settings size={20} className="text-purple-400" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white">{t.settings}</h3>
              </div>
              <button onClick={() => setIsMobileSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{t.market_data}</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold text-gray-400">{t.language}</span>
                    <LanguageSwitcher language={language} setLanguage={setLanguage} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <button 
                  onClick={() => {
                    setIsMobileSettingsOpen(false);
                    resetToDefault('SPOT');
                    resetToDefault('FUTURES');
                  }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> {t.retry}
                </button>

                <button 
                  onClick={() => {
                    setIsMobileSettingsOpen(false);
                    onLogout();
                  }}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> {t.exit_btn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSubscriptionPrompt && (
        <SubscriptionPrompt 
          language={language} 
          onClose={() => setShowSubscriptionPrompt(false)} 
          onNavigateToSubscription={onNavigateToProfile}
        />
      )}
    </div>
  );
};

export default Dashboard;
