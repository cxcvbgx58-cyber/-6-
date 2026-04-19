
import { WebSocket } from 'ws';
import { 
  RowData, 
  SettingsState, 
  Density, 
  Side, 
  OrderBookLevel, 
  OrderBookEntry, 
  MarketType, 
  SymbolState, 
  DensityType,
  DEFAULT_SETTINGS
} from '../../models/index.ts';

const CONFIG = {
  engineTickMs: 500,
  MOVE_TOLERANCE_PCT: 0.0005, 
  TTL_MS: 10000, 
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000, 
  DEPTH_UPDATE_TICKS: 3, 
};

const safeFloat = (val: any, def: number) => {
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? def : n;
};

export class ServerSmarteyeEngine {
  private marketState: Record<string, SymbolState> = {};
  private activeDensities = new Map<string, Density>();
  private tickCounter = 0;
  private lastDeepCleanup = Date.now();
  private settings: Record<MarketType, SettingsState> = {
    'SPOT': { ...DEFAULT_SETTINGS },
    'FUTURES': { ...DEFAULT_SETTINGS }
  };

  public longs: RowData[] = [];
  public shorts: RowData[] = [];

  constructor() {
    setInterval(() => this.engineTick(), CONFIG.engineTickMs);
  }

  public updateData(exchange: string, marketType: MarketType, data: any) {
    try {
      // Extract symbol generically
      const rawSymbol = data.s || data.symbol || data.data?.s || 
                       (data.topic?.split('.').pop()) || 
                       (typeof data.stream === 'string' ? data.stream.split('@')[0] : null);
      
      if (!rawSymbol) return;
      const symbol = String(rawSymbol).toUpperCase();
      
      const key = `${exchange}:${marketType}:${symbol}`;
      this.ensureStateExists(key, symbol, exchange, marketType);
      const state = this.marketState[key];

      // Sequence and Snapshot handling
      const isSnapshot = data.type === 'snapshot';
      const seq = data.data?.u || data.u || data.ts || data.E;

      if (isSnapshot) {
        state.lastSeq = seq;
        state.isReady = true;
      } else if (exchange.startsWith('Bybit')) {
        if (!state.isReady) return;
        if (state.lastSeq && seq <= state.lastSeq) return;
        state.lastSeq = seq;
      } else {
        state.isReady = true;
        if (state.lastSeq && seq <= state.lastSeq) return;
        state.lastSeq = seq;
      }

      state.lastUpdate = Date.now();
      const depthData = data.data || data;
      
      this.parseDepth(state, depthData, exchange, isSnapshot);
      this.updateMidPrice(state);
    } catch (e) {
      console.error("[Server Engine] Error processing data:", e);
    }
  }

  private ensureStateExists(key: string, symbol: string, exchange: string, marketType: MarketType) {
    if (!this.marketState[key]) {
      this.marketState[key] = {
        symbol: symbol.toUpperCase(),
        exchange,
        marketType, 
        asks: new Map(), bids: new Map(), currentPrice: 0, 
        lastUpdate: Date.now(), isReady: false, cleaned: false
      };
    }
  }

  private parseDepth(state: SymbolState, data: any, exchange: string, isSnapshot: boolean) {
    const MAX_LEVELS_PER_SIDE = 500; 
    const MAX_BOOK_DIST_PCT = 0.05; 
    
    const update = (map: Map<number, number>, arr: any[], side: Side) => {
      if (!arr) return;
      if (isSnapshot) {
        map.clear();
        if (side === 'bid') state.bestBid = 0;
        else state.bestAsk = Infinity;
      }
      
      const mid = state.currentPrice;
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        let price, qty;
        if (Array.isArray(item)) {
          price = +item[0]; qty = +item[1];
        } else {
          price = +item.price; 
          qty = item.size !== undefined ? +item.size : +item.qty;
        }

        if (mid > 0 && Math.abs(price - mid) / mid > MAX_BOOK_DIST_PCT) { 
          map.delete(price); 
          continue; 
        }
        
        if (qty === 0) {
          map.delete(price);
          if (side === 'bid' && price === state.bestBid) state.bestBid = 0;
          if (side === 'ask' && price === state.bestAsk) state.bestAsk = Infinity;
        } else {
          map.set(price, qty);
          if (side === 'bid') {
            if (price > (state.bestBid || 0)) state.bestBid = price;
          } else {
            if (price < (state.bestAsk || Infinity)) state.bestAsk = price;
          }
        }
      }
      
      if (!state.cleaned && mid > 0) {
        for (const [p] of map) {
          if (Math.abs(p - mid) / mid > MAX_BOOK_DIST_PCT) {
            map.delete(p);
            if (side === 'bid' && p === state.bestBid) state.bestBid = 0;
            if (side === 'ask' && p === state.bestAsk) state.bestAsk = Infinity;
          }
        }
        state.cleaned = true;
      }
      
      if (map.size > MAX_LEVELS_PER_SIDE) {
        const prices = [];
        for (const [p] of map) prices.push(p);
        if (side === 'bid') prices.sort((a, b) => b - a);
        else prices.sort((a, b) => a - b);
        
        for (let i = MAX_LEVELS_PER_SIDE; i < prices.length; i++) {
          map.delete(prices[i]);
        }
      }
    };

    update(state.asks, data.asks || data.a, 'ask');
    update(state.bids, data.bids || data.b, 'bid');
  }

  private updateMidPrice(state: SymbolState) {
    if (!state.bestBid || state.bestBid === 0) {
      let b = 0;
      for (const [p] of state.bids) { if (p > b) b = p; }
      state.bestBid = b;
    }
    if (!state.bestAsk || state.bestAsk === Infinity) {
      let a = Infinity;
      for (const [p] of state.asks) { if (p < a) a = p; }
      state.bestAsk = a;
    }

    if (state.bestAsk !== Infinity && state.bestBid !== 0) {
      state.currentPrice = (state.bestAsk + state.bestBid) / 2;
    }
  }

  private engineTick() {
    const now = Date.now();
    this.tickCounter++;

    for (const key in this.marketState) {
      const state = this.marketState[key];
      if (!state.currentPrice || !state.isReady) continue;
      if (now - state.lastUpdate > 30000) {
         delete this.marketState[key];
         continue;
      }

      const settings = this.settings[state.marketType];
      const maxDist = (safeFloat(settings.distancePercentage, 2.0) / 100);
      const minAbsVol = 100000;
      const minDensityVol = safeFloat(settings.minDensityVolume, 40000);
      const peerMultiplier = safeFloat(settings.peerMultiplier, 2.5);
      const peerCount = 6;
      
      const getObserveTime = (price: number) => {
        const dist = Math.abs(price - state.currentPrice) / state.currentPrice;
        return dist > 0.003 ? 60000 : 15000;
      };

      (['bid', 'ask'] as Side[]).forEach(side => {
        const map = side === 'bid' ? state.bids : state.asks;
        const topLevels = this.getTopNFromMap(map, state.currentPrice, maxDist, 20);
        
        if (topLevels.length > 0) {
          const candidate = topLevels[0];
          const currentRD = this.calculateRD(candidate.volume, topLevels, candidate.price, peerCount, minAbsVol);

          if (candidate.volume >= minDensityVol && currentRD >= peerMultiplier) {
            let density: Density | undefined;
            for (const d of this.activeDensities.values()) {
              if (d.pair === state.symbol.replace('USDT', '') && d.side === side && d.exchange === state.exchange && d.marketType === state.marketType) {
                const pDiff = Math.abs(d.corePrice - candidate.price) / d.corePrice;
                if (pDiff <= CONFIG.MOVE_TOLERANCE_PCT) {
                  density = d;
                  if (d.corePrice !== candidate.price) {
                     this.activeDensities.delete(d.id);
                     d.corePrice = candidate.price;
                     d.price = candidate.price;
                     d.id = `${d.exchange}:${d.marketType}:${state.symbol}:${side}:${candidate.price}`;
                     this.activeDensities.set(d.id, d);
                  }
                  break;
                }
              }
            }

            if (!density) {
              const pKey = `${state.exchange}:${state.marketType}:${state.symbol}:${side}:${candidate.price}`;
              density = {
                id: pKey,
                pair: state.symbol.replace('USDT', ''), exchange: state.exchange, marketType: state.marketType,
                side, price: candidate.price, reactionPrice: candidate.price, vwapPrice: candidate.price, corePrice: candidate.price,
                coreQty: candidate.qty, coreVolume: candidate.volume, clusterVolume: candidate.volume, maxSeenCoreVolume: candidate.volume,
                maxSeenClusterVolume: candidate.volume, baseLocalMedian: minAbsVol, baseGlobalAvg: minAbsVol, initialRelativeVolume: currentRD,
                globalRelative: currentRD, localRelative: currentRD, relativeVolume: currentRD, maxSeenRelativeVolume: currentRD,
                clusterSize: 1, activeClusterSize: 1, createdAt: now, lastUpdate: now, lastVolumeSeenAt: now, calibrated: false,
                tickCount: 0, rdMissCount: 0, confirmed: false, state: 'OBSERVE', alive: true, type: DensityType.SINGLE,
                confidence: 100, isMoving: false
              };
              this.activeDensities.set(pKey, density);
            }

            if (density) {
              density.coreQty = candidate.qty;
              density.coreVolume = candidate.volume;
              density.relativeVolume = currentRD;
              density.lastUpdate = now;
              if (candidate.volume > density.maxSeenCoreVolume) density.maxSeenCoreVolume = candidate.volume;
              if (now - density.createdAt >= getObserveTime(density.corePrice)) {
                density.state = 'ACTIVE';
              }
              if (this.tickCounter % CONFIG.DEPTH_UPDATE_TICKS === 0) {
                density.depthSlice = this.getDepthSlice(map, density.corePrice, side);
              }
            }
          }
        }
      });
    }

    const densitiesToDelete: string[] = [];
    for (const [pKey, density] of this.activeDensities) {
      const stateKey = `${density.exchange}:${density.marketType}:${density.pair}USDT`;
      const state = this.marketState[stateKey];
      const settings = this.settings[density.marketType];
      
      if (!state) {
        densitiesToDelete.push(pKey);
        continue;
      }

      const map = density.side === 'bid' ? state.bids : state.asks;
      const currentQty = map.get(density.corePrice);
      
      if (currentQty === undefined) {
        if (now - density.lastUpdate > CONFIG.TTL_MS) densitiesToDelete.push(pKey);
        continue;
      }

      const currentVol = currentQty * density.corePrice;
      const minDensityVol = safeFloat(settings.minDensityVolume, 40000);
      if (currentVol < minDensityVol || currentVol < (density.maxSeenCoreVolume * 0.7)) {
        densitiesToDelete.push(pKey);
        continue;
      }

      const maxDist = (safeFloat(settings.distancePercentage, 2.0) / 100);
      if (Math.abs(density.corePrice - state.currentPrice) / state.currentPrice > maxDist) {
        densitiesToDelete.push(pKey);
        continue;
      }

      const topLevels = this.getTopNFromMap(map, state.currentPrice, maxDist, 20);
      const peerMultiplier = safeFloat(settings.peerMultiplier, 2.5);
      const currentRD = this.calculateRD(currentVol, topLevels, density.corePrice, 6, 100000);
      
      if (currentRD < peerMultiplier) {
        densitiesToDelete.push(pKey);
        continue;
      }

      density.coreQty = currentQty;
      density.coreVolume = currentVol;
      density.relativeVolume = currentRD;
      density.lastUpdate = now;

      if (this.tickCounter % CONFIG.DEPTH_UPDATE_TICKS === 0) {
        density.depthSlice = this.getDepthSlice(map, density.corePrice, density.side);
      }
    }

    for (const id of densitiesToDelete) this.activeDensities.delete(id);
    this.processRanks();
  }

  private getTopNFromMap(map: Map<number, number>, currentPrice: number, maxDist: number, n: number): OrderBookLevel[] {
    const candidates: OrderBookLevel[] = [];
    for (const [price, qty] of map) {
      if (Math.abs(price - currentPrice) / currentPrice <= maxDist) {
        candidates.push({ price, qty, volume: price * qty });
      }
    }
    candidates.sort((a, b) => b.volume - a.volume);
    if (candidates.length > n) candidates.length = n;
    return candidates;
  }

  private calculateRD(candidateVol: number, allLevels: OrderBookLevel[], targetPrice: number, peerCount: number, minAbsVol: number): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < allLevels.length; i++) {
      const l = allLevels[i];
      if (Math.abs(l.price - targetPrice) / targetPrice > 0.000001) {
        sum += l.volume;
        count++;
        if (count >= peerCount) break;
      }
    }
    const avgRest = count > 0 ? (sum / count) : 0;
    return candidateVol / (Math.max(avgRest, minAbsVol) || 1);
  }

  private getDepthSlice(map: Map<number, number>, targetPrice: number, side: Side): OrderBookEntry[] {
    const entries: OrderBookLevel[] = [];
    for (const [price, qty] of map) {
      entries.push({ price, qty, volume: price * qty });
    }
    entries.sort((a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice));
    const slice = entries.slice(0, 8);
    if (side === 'bid') slice.sort((a, b) => b.price - a.price);
    else slice.sort((a, b) => a.price - b.price);
    const maxVol = Math.max(...slice.map(l => l.volume), 1);
    return slice.map(l => ({
      price: l.price,
      volume: l.volume,
      relativeSize: l.volume / maxVol,
      isDensity: Math.abs(l.price - targetPrice) / targetPrice < 0.000001
    }));
  }

  private processRanks() {
    const now = Date.now();
    const longs: RowData[] = [];
    const shorts: RowData[] = [];

    for (const d of this.activeDensities.values()) {
      if (d.state !== 'ACTIVE') continue;
      const state = this.marketState[`${d.exchange}:${d.marketType}:${d.pair}USDT`];
      const mid = state?.currentPrice || d.corePrice;
      const dist = ((d.corePrice - mid) / mid) * 100;
      
      const ageMinutes = (now - d.createdAt) / 60000;
      const rdFactor = Math.min(d.relativeVolume / 10, 1); 
      const ageFactor = Math.min(ageMinutes / 5, 1); 
      const rating = Math.round((rdFactor * 60) + (ageFactor * 40));

      const row: RowData = {
        id: d.id,
        pair: d.pair,
        price: d.corePrice,
        currentPrice: mid,
        reactionPrice: d.corePrice,
        coreQty: d.coreQty,
        rawVolume: d.coreVolume,
        percentage: dist.toFixed(4),
        side: d.side,
        exchange: d.exchange,
        marketType: d.marketType,
        relDensity: d.relativeVolume,
        state: d.state,
        type: d.type,
        depth: d.depthSlice,
        rating: Math.max(10, Math.min(100, rating))
      };

      if (d.side === 'bid') longs.push(row);
      else shorts.push(row);
    }
    
    this.longs = longs;
    this.shorts = shorts;
  }
}
