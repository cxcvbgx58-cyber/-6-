
import React, { useEffect, useState } from 'react';
import './QuantumCard.css';
import { SmarteyeEngineService } from '../services/smarteye-engine.service';
import { RowData } from '../models';

interface QuantumCardProps {
  engine?: SmarteyeEngineService;
}

export const QuantumCard: React.FC<QuantumCardProps> = ({ engine }) => {
  const [state, setState] = useState({
    pair: 'BTC / USD',
    exchange: 'BINANCE',
    price: 0,
    density: 0,
    distancePct: 0,
    updatedAt: new Date(),
    type: 'SPOT'
  });

  useEffect(() => {
    if (!engine) return;

    const sub = engine.longs$.subscribe(longs => {
      if (longs.length > 0) {
        const top = longs[0] as RowData; // Top density
        setState({
          pair: `${top.pair} / USDT`,
          exchange: (top.exchange || 'BINANCE').toUpperCase(),
          price: typeof top.price === 'string' ? parseFloat(top.price) : top.price,
          density: top.relDensity || 0,
          distancePct: typeof top.percentage === 'string' ? parseFloat(top.percentage) : (top.percentage || 0),
          updatedAt: new Date(),
          type: (top.marketType || 'SPOT').toUpperCase()
        });
      }
    });

    return () => sub.unsubscribe();
  }, [engine]);

  // Fallback simulation if no engine or no data yet
  useEffect(() => {
    if (engine) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (prev.price === 0) {
          return {
            ...prev,
            price: 96420.50,
            density: 0.842,
            distancePct: 1.24
          };
        }
        const volatility = Math.random() > 0.9 ? 120 : 25;
        const move = (Math.random() - 0.5) * volatility;
        const newDensity = Math.min(1.0, Math.max(0.1, prev.density + (Math.random() - 0.5) * 0.05));
        
        return {
          ...prev,
          price: prev.price + move,
          density: newDensity,
          distancePct: prev.distancePct + (Math.random() - 0.5) * 0.08,
          updatedAt: new Date()
        };
      });
    }, 800);

    return () => clearInterval(interval);
  }, [engine]);

  return (
    <div className="qc-hud-card !w-[520px] !min-h-[min-content]">
      <div className="qc-hud-scanline"></div>
      
      {/* HUD Frame Elements */}
      <div className="qc-hud-content">
        {/* Header */}
        <div className="qc-hud-header">
           <div className="qc-hud-header-left">
              <div className="qc-logo-convex !w-8 !h-8 !bg-purple-900/80 border border-purple-500/30">
                <div className="qc-logo !w-5 !h-5 flex items-center justify-center text-[10px] font-bold text-white">
                  {state.pair.split(' ')[0][0]}
                </div>
              </div>
              <div className="qc-hud-meta">
                  <span className="qc-hud-exchange">{state.exchange}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="qc-hud-pair leading-none">{state.pair}</span>
                    <div className={`qc-hud-market-type font-black uppercase tracking-widest font-mono leading-none text-white text-[13px] pb-0.5 border-b ${state.type === 'SPOT' ? 'border-blue-600' : 'border-orange-500'}`}>{state.type}</div>
                  </div>
              </div>
           </div>
           
           <div className="qc-hud-status">
              <span className="qc-hud-status-text !text-purple-400">LIVE</span>
              <div className="qc-hud-blinker !bg-purple-500 !shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div>
           </div>
        </div>

        {/* Main Price Box */}
        <div className="qc-hud-price-box">
           <div className="qc-hud-label-tiny">DENSITY PRICE</div>
           <div className="qc-hud-price-val">
             {state.price.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
             <span className="qc-hud-currency">USDT</span>
           </div>
        </div>

        {/* Technical Grid */}
        <div className="qc-hud-grid !grid-cols-2">
           <div className="qc-hud-metric-box">
              <div className="qc-metric-label">DENSITY</div>
              <div className="qc-metric-value !text-purple-400">{state.density.toFixed(3)}</div>
           </div>

           <div className="qc-hud-metric-box">
              <div className="qc-metric-label">DISTANCE (%)</div>
              <div className="qc-metric-value !text-purple-400">
                 {state.distancePct > 0 ? '+' : ''}{state.distancePct.toFixed(2)}%
              </div>
           </div>
        </div>

        <div className="qc-hud-footer">
           <span>{state.updatedAt.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
