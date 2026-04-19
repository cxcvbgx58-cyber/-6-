
import { BehaviorSubject, map } from 'rxjs';
import { apiService } from './api.service';

export interface Position {
  id: string;
  symbol: string;
  exchange: string;
  market: 'SPOT' | 'FUTURES';
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  liquidationPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  amount: number; // margin in USDT
  leverage: number;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  amount: number; // margin
  leverage: number;
  pnl: number;
  timestamp: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  exchange: string;
  market: 'SPOT' | 'FUTURES';
  side: 'LONG' | 'SHORT';
  limitPrice: number;
  initialPrice: number;
  amount: number; // margin
  leverage: number;
  timestamp: number;
}

export interface SimulatorState {
  balance: number;
  positions: Position[];
  pendingOrders: PendingOrder[];
  history: Trade[];
}

const STORAGE_KEY = 'smarteye_simulator_v1';

const INITIAL_STATE: SimulatorState = {
  balance: 1000,
  positions: [],
  pendingOrders: [],
  history: []
};

export class TradingSimulatorService {
  private static instance: TradingSimulatorService;
  private state$ = new BehaviorSubject<SimulatorState>(INITIAL_STATE);
  private simulatedPrice$ = new BehaviorSubject<{ [symbol: string]: number }>({});
  private userId: string | null = null;
  public readonly simulatedPriceObs$ = this.simulatedPrice$.asObservable();

  public readonly positions$ = this.state$.pipe(map(s => s.positions));
  public readonly pendingOrders$ = this.state$.pipe(map(s => s.pendingOrders));

  private constructor() {
    // Persistence disabled as per user request
  }

  public static getInstance(): TradingSimulatorService {
    if (!TradingSimulatorService.instance) {
      TradingSimulatorService.instance = new TradingSimulatorService();
    }
    return TradingSimulatorService.instance;
  }

  public setUserId(id: string | null, balance?: number) {
    this.userId = id;
    if (id) {
      this.loadDataFromDb(id, balance);
    }
  }

  private async loadDataFromDb(userId: string, balance?: number) {
    try {
      const [dbTrades, dbPositions, dbOrders] = await Promise.all([
        apiService.getTrades(userId),
        apiService.getPositions(userId),
        apiService.getPendingOrders(userId)
      ]);

      const history = dbTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        entryPrice: Number(t.entry_price),
        exitPrice: Number(t.exit_price),
        amount: Number(t.amount),
        leverage: t.leverage,
        pnl: Number(t.pnl),
        timestamp: new Date(t.timestamp).getTime()
      }));

      const positions = dbPositions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        exchange: p.exchange,
        market: p.market,
        side: p.side,
        entryPrice: Number(p.entry_price),
        liquidationPrice: Number(p.liquidation_price),
        takeProfit: p.take_profit ? Number(p.take_profit) : undefined,
        stopLoss: p.stop_loss ? Number(p.stop_loss) : undefined,
        amount: Number(p.amount),
        leverage: p.leverage,
        timestamp: new Date(p.timestamp).getTime()
      }));

      const pendingOrders = dbOrders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        exchange: o.exchange,
        market: o.market,
        side: o.side,
        limitPrice: Number(o.limit_price),
        initialPrice: Number(o.initial_price),
        amount: Number(o.amount),
        leverage: o.leverage,
        timestamp: new Date(o.timestamp).getTime()
      }));
      
      this.state$.next({ 
        balance: balance !== undefined ? balance : 1000, 
        history, 
        positions, 
        pendingOrders 
      });
    } catch (error) {
      console.error('Failed to load data from DB:', error);
    }
  }

  public setSimulatedPrice(symbol: string, price: number | null) {
    const current = this.simulatedPrice$.getValue();
    if (price === null) {
      const { [symbol]: _, ...rest } = current;
      this.simulatedPrice$.next(rest);
    } else {
      this.simulatedPrice$.next({ ...current, [symbol]: price });
    }
  }

  public getSimulatedPrice(symbol: string): number | null {
    return this.simulatedPrice$.getValue()[symbol] || null;
  }

  private loadState(): SimulatorState {
    return INITIAL_STATE;
  }

  getState$() {
    return this.state$.asObservable();
  }

  getCurrentState() {
    return this.state$.getValue();
  }

  openPosition(symbol: string, exchange: string, market: 'SPOT' | 'FUTURES', side: 'LONG' | 'SHORT', price: number, amount: number, leverage: number = 1, isLimit: boolean = false, currentPrice?: number) {
    const state = this.getCurrentState();
    const actualAmount = amount > state.balance ? state.balance : amount;
    
    if (actualAmount <= 0) return false;

    if (isLimit) {
      const newOrder: PendingOrder = {
        id: Math.random().toString(36).substr(2, 9),
        symbol,
        exchange,
        market,
        side,
        limitPrice: price,
        initialPrice: currentPrice ?? price,
        amount: actualAmount,
        leverage,
        timestamp: Date.now()
      };

      if (this.userId) {
        apiService.savePendingOrder({
          userId: this.userId,
          symbol,
          exchange,
          market,
          side,
          limitPrice: price,
          initialPrice: currentPrice ?? price,
          amount: actualAmount,
          leverage
        }).then(dbOrder => {
          const updatedState = this.getCurrentState();
          this.state$.next({
            ...updatedState,
            pendingOrders: updatedState.pendingOrders.map(o => o.id === newOrder.id ? { ...o, id: dbOrder.id } : o)
          });
        });
      }

      this.state$.next({
        ...state,
        balance: state.balance - actualAmount,
        pendingOrders: [...state.pendingOrders, newOrder]
      });
      return true;
    }

    const liqPrice = side === 'LONG' 
      ? price * (1 - 1/leverage)
      : price * (1 + 1/leverage);

    const newPosition: Position = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      exchange,
      market,
      side,
      entryPrice: price,
      liquidationPrice: liqPrice,
      amount: actualAmount,
      leverage,
      timestamp: Date.now()
    };

    if (this.userId) {
      apiService.savePosition({
        userId: this.userId,
        symbol,
        exchange,
        market,
        side,
        entryPrice: price,
        liquidationPrice: liqPrice,
        amount: actualAmount,
        leverage
      }).then(dbPos => {
        const updatedState = this.getCurrentState();
        this.state$.next({
          ...updatedState,
          positions: updatedState.positions.map(p => p.id === newPosition.id ? { ...p, id: dbPos.id } : p)
        });
      });
    }

    this.state$.next({
      ...state,
      balance: state.balance - actualAmount,
      positions: [...state.positions, newPosition]
    });
    return true;
  }

  cancelOrder(orderId: string) {
    const state = this.getCurrentState();
    const order = state.pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    if (this.userId && !orderId.includes('.')) { // Simple check for DB ID
      apiService.deletePendingOrder(orderId).catch(err => console.error('Failed to delete order from DB:', err));
    }

    this.state$.next({
      ...state,
      balance: state.balance + order.amount,
      pendingOrders: state.pendingOrders.filter(o => o.id !== orderId)
    });
  }

  checkLiquidations(symbol: string, exchange: string, market: 'SPOT' | 'FUTURES', currentPrice: number) {
    const state = this.getCurrentState();
    const simulatedPrice = this.getSimulatedPrice(symbol);
    const price = simulatedPrice !== null ? simulatedPrice : currentPrice;
    
    // Check Pending Orders
    const triggeredOrders = state.pendingOrders.filter(order => {
      if (order.symbol !== symbol || order.exchange !== exchange || order.market !== market) return false;
      
      // Directional triggering: price must reach or cross the limit from the initial side
      if (order.side === 'LONG') {
        if (order.initialPrice >= order.limitPrice) {
          // Normal limit buy (price was above limit, now it's at or below)
          return price <= order.limitPrice;
        } else {
          // Stop buy (price was below limit, now it's at or above)
          return price >= order.limitPrice;
        }
      } else {
        if (order.initialPrice <= order.limitPrice) {
          // Normal limit sell (price was below limit, now it's at or above)
          return price >= order.limitPrice;
        } else {
          // Stop sell (price was above limit, now it's at or below)
          return price <= order.limitPrice;
        }
      }
    });

    let newState = { ...state };

    if (triggeredOrders.length > 0) {
      const triggeredIds = triggeredOrders.map(o => o.id);
      const newPositions = [...newState.positions];
      
      triggeredOrders.forEach(order => {
        const liqPrice = order.side === 'LONG' 
          ? order.limitPrice * (1 - 1/order.leverage)
          : order.limitPrice * (1 + 1/order.leverage);

        newPositions.push({
          id: order.id,
          symbol: order.symbol,
          exchange: order.exchange,
          market: order.market,
          side: order.side,
          entryPrice: order.limitPrice,
          liquidationPrice: liqPrice,
          amount: order.amount,
          leverage: order.leverage,
          timestamp: Date.now()
        });
      });

      newState = {
        ...newState,
        positions: newPositions,
        pendingOrders: newState.pendingOrders.filter(o => !triggeredIds.includes(o.id))
      };
    }

    // Check Liquidations, TP, and SL
    const toClose = newState.positions.filter(pos => {
      if (pos.symbol !== symbol || pos.exchange !== exchange || pos.market !== market) return false;
      
      // Check Liquidation
      if (pos.side === 'LONG') {
        if (price <= pos.liquidationPrice) return true;
      } else {
        if (price >= pos.liquidationPrice) return true;
      }

      // Check Take Profit
      if (pos.takeProfit) {
        if (pos.side === 'LONG' && price >= pos.takeProfit) return true;
        if (pos.side === 'SHORT' && price <= pos.takeProfit) return true;
      }

      // Check Stop Loss
      if (pos.stopLoss) {
        if (pos.side === 'LONG' && price <= pos.stopLoss) return true;
        if (pos.side === 'SHORT' && price >= pos.stopLoss) return true;
      }

      return false;
    });

    if (toClose.length > 0) {
      const closedIds = toClose.map(p => p.id);
      const newHistory = [...newState.history];

      toClose.forEach(pos => {
        let exitPrice = price;
        let pnl = 0;
        const size = pos.amount * pos.leverage;

        // Determine if it was a liquidation, TP, or SL
        const isLiq = pos.side === 'LONG' ? price <= pos.liquidationPrice : price >= pos.liquidationPrice;
        
        if (isLiq) {
          exitPrice = pos.liquidationPrice;
          pnl = -pos.amount;
        } else {
          // TP or SL
          if (pos.side === 'LONG') {
            pnl = (price / pos.entryPrice - 1) * size;
          } else {
            pnl = (1 - price / pos.entryPrice) * size;
          }
        }

        const trade: Trade = {
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: pos.entryPrice,
          exitPrice: exitPrice,
          amount: pos.amount,
          leverage: pos.leverage,
          pnl: pnl,
          timestamp: Date.now()
        };
        newHistory.unshift(trade);

        // Persist to DB
        if (this.userId) {
          apiService.saveTrade({
            user_id: this.userId,
            symbol: trade.symbol,
            side: trade.side,
            entry_price: trade.entryPrice,
            exit_price: trade.exitPrice,
            amount: trade.amount,
            leverage: trade.leverage,
            pnl: trade.pnl
          }).catch(err => console.error('Failed to save trade to DB:', err));

          // Also delete the position from DB if it was an active position
          if (!pos.id.includes('.')) {
            apiService.deletePosition(pos.id).catch(err => console.error('Failed to delete position from DB:', err));
          }
        }
        
        // Return margin + pnl to balance if not liquidated
        if (!isLiq) {
          newState.balance += pos.amount + pnl;
        }
      });

      newState = {
        ...newState,
        positions: newState.positions.filter(p => !closedIds.includes(p.id)),
        history: newHistory.slice(0, 50)
      };
    }

    if (triggeredOrders.length > 0 || toClose.length > 0) {
      this.state$.next(newState);
    }
  }

  closePosition(positionId: string, currentPrice: number) {
    const state = this.getCurrentState();
    const pos = state.positions.find(p => p.id === positionId);
    if (!pos) return;

    let pnl = 0;
    const size = pos.amount * pos.leverage;
    if (pos.side === 'LONG') {
      pnl = (currentPrice / pos.entryPrice - 1) * size;
    } else {
      pnl = (1 - currentPrice / pos.entryPrice) * size;
    }

    const trade: Trade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      amount: pos.amount,
      leverage: pos.leverage,
      pnl: pnl,
      timestamp: Date.now()
    };

    // Persist to DB
    if (this.userId) {
      apiService.saveTrade({
        user_id: this.userId,
        symbol: trade.symbol,
        side: trade.side,
        entry_price: trade.entryPrice,
        exit_price: trade.exitPrice,
        amount: trade.amount,
        leverage: trade.leverage,
        pnl: trade.pnl
      }).catch(err => console.error('Failed to save trade to DB:', err));

      // Delete position from DB
      if (!positionId.includes('.')) {
        apiService.deletePosition(positionId).catch(err => console.error('Failed to delete position from DB:', err));
      }
    }

    this.state$.next({
      ...state,
      balance: state.balance + pos.amount + pnl,
      positions: state.positions.filter(p => p.id !== positionId),
      history: [trade, ...state.history].slice(0, 50)
    });
  }

  updatePositionTPSL(positionId: string, takeProfit?: number, stopLoss?: number) {
    const state = this.getCurrentState();
    const positions = state.positions.map(p => {
      if (p.id === positionId) {
        return { ...p, takeProfit, stopLoss };
      }
      return p;
    });

    this.state$.next({
      ...state,
      positions
    });
  }

  reset() {
    this.state$.next(INITIAL_STATE);
  }

  setBalance(newBalance: number) {
    const state = this.getCurrentState();
    this.state$.next({
      ...state,
      balance: newBalance
    });
  }
}

export const simulatorService = TradingSimulatorService.getInstance();
