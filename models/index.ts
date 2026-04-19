
export type MarketType = 'SPOT'|'FUTURES';

export interface MarketCoin {
  symbol: string;
  baseAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  market: 'SPOT' | 'FUTURES';
  exchange: 'Binance' | 'Bybit';
  logo: string;
}

export type Side = 'bid' | 'ask';

export interface OrderBookLevel {
  price: number;
  qty: number;
  volume: number; // price * qty
}

export interface OrderBookEntry {
  price: number;
  volume: number;
  relativeSize: number;
  isDensity: boolean;
}

export const DensityType = {
  SINGLE: 'SINGLE' as const,
  CLUSTER: 'CLUSTER' as const,
};
export type DensityType = 'SINGLE' | 'CLUSTER';

export interface ExchangeConfig {
  wsUrl: string;
  exchange: string;
  marketType: MarketType;
  isSnapshot?: boolean;
  symbols?: string[]; 
  subscriptionMessages?: any[];
  pingConfig?: {
    intervalMs: number;
    message: any;
  };
}

export interface SymbolState {
  symbol: string;
  exchange: string;
  marketType: MarketType;
  asks: Map<number, number>;
  bids: Map<number, number>;
  bestBid?: number;
  bestAsk?: number;
  currentPrice: number;
  lastUpdate: number;
  lastSeq?: number; // Для отслеживания последовательности обновлений (Bybit u / seq)
  isReady?: boolean; // Флаг готовности стакана (получен snapshot)
  cleaned?: boolean; // Флаг первичной очистки стакана по дистанции
}

export interface Density {
  id: string;
  pair: string;
  exchange: string;
  marketType: MarketType;
  price: number; 
  vwapPrice: number; 
  reactionPrice: number; 
  side: Side;
  corePrice: number; 
  coreQty: number; 
  coreVolume: number; 
  clusterVolume: number; 
  maxSeenCoreVolume: number; 
  maxSeenClusterVolume: number; 
  
  baseLocalMedian: number;
  baseGlobalAvg: number;
  initialRelativeVolume: number;
  clusterSize: number;
  activeClusterSize?: number;

  globalRelative: number;
  localRelative: number;
  relativeVolume: number; 
  maxSeenRelativeVolume: number; 
  createdAt: number;
  lastUpdate: number;
  lastVolumeSeenAt: number; 
  state: 'OBSERVE' | 'ACTIVE';
  alive: boolean;
  type: DensityType;
  clusterRange?: [number, number];
  
  calibrated: boolean;
  calibratedAt?: number;
  tickCount: number;
  rdMissCount: number;
  confirmed: boolean; 
  
  // New behavioral metrics
  confidence: number; // 0 to 100
  isMoving: boolean;
  depthSlice?: OrderBookEntry[];
}

export interface RowData {
  pair: string;
  price: string | number;
  currentPrice?: number;
  reactionPrice?: string | number;
  size?: string;
  rawVolume?: number;
  coreQty?: number;
  percentage?: string;
  m?: string;
  expanded?: boolean;
  marketType?: MarketType;
  exchange?: string;
  state?: string;
  side?: Side;
  globalRel?: number;
  localRel?: number;
  relDensity?: number;
  type?: DensityType;
  clusterRange?: [number, number];
  activeLevels?: number;
  id: string;
  confidence?: number;
  rating?: number;
  depth?: OrderBookEntry[];
  [k: string]: any;
}

export interface SettingsState {
  volumeFilter: string;
  minDensityVolume: string;
  distancePercentage: string;
  peerMultiplier: string;
  peerCount: string;
  densityObserveTimeMs: string;
  degradationThreshold: string;
  rdMissLimit: string;
  activeCoin?: any;
  timeframe?: string;
  favorites?: string[];
  drawings?: Record<string, any[]>;
  activeExchanges?: Record<string, boolean>;
  activeTypes?: Record<string, boolean>;
  viewMode?: string;
  sortConfig?: { key: string, dir: string };
  comparisonCoins?: any[];
  chartLayout?: number;
  selectedExchanges?: Record<string, boolean>;
  spotSettings?: any;
  futuresSettings?: any;
  soundAlertEnabled?: boolean;
  soundAlertVolume?: number;
}

export type ExchangeSelection = Record<string, boolean>;

/**
Список символов: ТОП-11 -> ТОП-80 (Binance)
Тяжелые активы (BTC, ETH, SOL, XRP и др.) исключены для лучшей фильтрации плотностей.
DYM, TON, APT и HBAR удалены по запросу из-за ботов.
*/
export const SYMBOLS = [
  // ТОП 11-20
  "POLUSDT", "SHIBUSDT", "AVAXUSDT", "LTCUSDT", "BCHUSDT", "NEARUSDT", "UNIUSDT", "ICPUSDT",
  // ТОП 21-30
  "PEPEUSDT", "ETCUSDT", "STXUSDT", "RENDERUSDT", "FILUSDT", "ARBUSDT", "VETUSDT", "OPUSDT", "IMXUSDT", "TIAUSDT",
  // ТОП 31-40
  "INJUSDT", "SUIUSDT", "GRTUSDT", "LDOUSDT", "THETAUSDT", "SEIUSDT", "FTMUSDT", "ALGOUSDT", "MKRUSDT", "EGLDUSDT",
  // ТОП 41-50
  "FLOWUSDT", "QNTUSDT", "SANDUSDT", "EOSUSDT", "GALAUSDT", "BEAMUSDT", "AXSUSDT", "MANAUSDT", "NEOUSDT", "RUNEUSDT",
  // ТОП 51-60
  "CHZUSDT", "FETUSDT", "ARUSDT", "ENAUSDT", "XTZUSDT", "CFXUSDT", "JUPUSDT", "PYTHUSDT", "STRKUSDT", "CRVUSDT",
  // ТОП 61-70
  "TAOUSDT", "NOTUSDT", "MINAUSDT", "ORDIUSDT", "AEVOUSDT", "ONDOUSDT", "PENDLEUSDT", "WUSDT", "WLDUSDT",
  // ТОП 71-80
  "JASMYUSDT", "BONKUSDT", "FLOKIUSDT", "SNXUSDT", "ATOMUSDT", "ZRXUSDT", "LRCUSDT", "AAVEUSDT", "BICOUSDT"
];

export const BYBIT_BLACKLIST = ["BEERUSDT", "1000PEPEUSDT", "1000SHIBUSDT"];
export const BYBIT_1000_SYMBOLS = ["PEPEUSDT", "SHIBUSDT", "BONKUSDT", "FLOKIUSDT", "RATSUSDT", "SATSUSDT", "XUSDT", "CATIUSDT"];

export const transformSymbolForBybit = (symbol: string, marketType: MarketType): string => {
  if (marketType === 'FUTURES' && BYBIT_1000_SYMBOLS.includes(symbol)) {
    return '1000' + symbol;
  }
  return symbol;
};

export const getConfigsForMarket = (marketType: MarketType, exchangeName: string): ExchangeConfig[] => {
  if (exchangeName.startsWith('Binance')) {
    const baseUrl = marketType === 'SPOT' ? 'wss://stream.binance.com:9443' : 'wss://fstream.binance.com';
    const streams = SYMBOLS.map(s => `${s.toLowerCase()}@depth@100ms`);
    
    // Binance can handle many symbols in one subscribe message, but let's chunk to be safe (max 200 per message recommended)
    const subscriptionMessages = [];
    const chunkSize = 50;
    for (let i = 0; i < streams.length; i += chunkSize) {
      subscriptionMessages.push({
        method: "SUBSCRIBE",
        params: streams.slice(i, i + chunkSize),
        id: Date.now() + i
      });
    }

    return [{
      wsUrl: `${baseUrl}/ws`,
      marketType,
      exchange: `Binance ${marketType === 'SPOT' ? 'Spot' : 'Futures'}`,
      isSnapshot: false,
      subscriptionMessages,
      pingConfig: {
        intervalMs: 3 * 60 * 1000, // 3 minutes
        message: { method: "PING", id: Date.now() }
      }
    }];
  } else if (exchangeName.startsWith('Bybit')) {
    const transformedSymbols = SYMBOLS.map(s => transformSymbolForBybit(s, marketType));
    const filteredSymbols = transformedSymbols.filter(s => !BYBIT_BLACKLIST.includes(s));
    const baseUrl = marketType === 'SPOT' ? 'wss://stream.bybit.com/v5/public/spot' : 'wss://stream.bybit.com/v5/public/linear';
    
    const depth = marketType === 'SPOT' ? 50 : 500;
    const subscriptionMessages = [];
    const chunkSize = 10;
    for (let i = 0; i < filteredSymbols.length; i += chunkSize) {
      subscriptionMessages.push({
        op: 'subscribe',
        args: filteredSymbols.slice(i, i + chunkSize).map(s => `orderbook.${depth}.${s.toUpperCase()}`)
      });
    }

    return [{
      wsUrl: baseUrl, 
      marketType, 
      exchange: `Bybit ${marketType === 'SPOT' ? 'Spot' : 'Futures'}`, 
      isSnapshot: false, 
      symbols: filteredSymbols,
      subscriptionMessages,
      pingConfig: {
        intervalMs: 20000,
        message: { op: 'ping' }
      }
    }];
  }
  return [];
};

export const STORAGE_PREFIX = 'smarteye_v4_'; 
export const DEFAULT_SETTINGS: SettingsState = {
  volumeFilter: '100000', 
  minDensityVolume: '40000', 
  distancePercentage: '2.0', 
  peerMultiplier: '2.5', 
  peerCount: '6', 
  densityObserveTimeMs: '10000', 
  degradationThreshold: '0.7', 
  rdMissLimit: '0',
  soundAlertEnabled: false,
  soundAlertVolume: 0.5
};

export const settingLabels: Record<keyof SettingsState, string> = {
  volumeFilter: 'Мин. объем уровня (USDT)',
  minDensityVolume: 'Мин. стена (USDT)',
  distancePercentage: 'Макс. расст. (%)',
  peerMultiplier: 'Коэфф. доминации (x)',
  peerCount: 'Кол-во заявок для анализа',
  densityObserveTimeMs: 'Время наблюдения (мс)',
  degradationThreshold: 'Порог деградации (0-1)',
  rdMissLimit: 'Лимит (не исп.)',
  soundAlertEnabled: 'Звуковой будильник',
  soundAlertVolume: 'Громкость будильника',
  activeCoin: 'Активная монета',
  timeframe: 'Таймфрейм',
  favorites: 'Избранное',
  drawings: 'Рисунки',
  activeExchanges: 'Биржи',
  activeTypes: 'Типы рынка',
  viewMode: 'Вид',
  sortConfig: 'Сортировка',
  comparisonCoins: 'Сравнение',
  chartLayout: 'Сетка графиков',
  selectedExchanges: 'Выбранные биржи',
  spotSettings: 'Настройки спота',
  futuresSettings: 'Настройки фьючерсов'
};

export interface DBUser {
  id: string;
  email: string;
  password?: string;
  username: string;
  subscription_tier: 'free' | 'pro' | 'whale';
  avatar_tier?: 'free' | '1month' | '3months' | '1year';
  premium_end_date?: string;
  telegram_id?: number;
  telegram_username?: string;
  telegram_first_name?: string;
  role: 'user' | 'admin';
  balance: number;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  user_id: string;
  message: string;
  sender_type: 'user' | 'admin';
  created_at: string;
}

export interface DBAlert {
  id: string;
  user_id: string;
  symbol: string;
  price: number;
  type: 'above' | 'below';
  is_active: boolean;
  created_at: string;
}

export interface DBTrade {
  id: string;
  user_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  amount: number;
  leverage: number;
  pnl: number;
  timestamp: string;
}

export interface PremiumPurchase {
  id: string;
  user_id: string;
  plan_tier: string;
  amount: number;
  purchase_date: string;
  expiry_date: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'unpaid' | 'paid';
  commission_amount: number;
  created_at: string;
  referred_email?: string;
  referred_username?: string;
  joined_at?: string;
}
