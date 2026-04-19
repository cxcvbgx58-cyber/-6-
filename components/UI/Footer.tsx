import React from 'react';
import { Send, Shield, FileText, Check } from 'lucide-react';
import { Logo } from './Icons';
import { Language, translations } from '../../src/translations';

interface FooterProps {
  language: Language;
  onOpenLegal?: (type: 'terms' | 'privacy') => void;
  onNavigate?: (target: 'screener' | 'market' | 'affiliate' | 'simulator') => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onOpenLegal, onNavigate }) => {
  const t = translations[language];

  const handleProductClick = (e: React.MouseEvent, target: 'screener' | 'market' | 'affiliate' | 'simulator') => {
    e.preventDefault();
    onNavigate?.(target);
  };

  return (
    <footer className="w-full mt-4 pt-4 pb-4 border-t-4 border-white/40 relative overflow-hidden bg-black/40 backdrop-blur-xl">
      {/* Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[100px] bg-purple-600/5 blur-[80px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
        {/* Brand Section */}
        <div className="md:col-span-3">
          <div className="-ml-6 mt-2">
            <Logo size="xl" noShadow />
          </div>
        </div>

        {/* Products Section */}
        <div className="md:col-span-5 space-y-3">
          <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
            {t.products_services}
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: t.screener_service, target: 'screener' as const },
              { label: t.coin_screener_service, target: 'screener' as const },
              { label: t.multi_charts_service, target: 'market' as const },
              { label: t.price_notifications_service, target: 'screener' as const },
              { label: t.demo_trading_service, target: 'simulator' as const },
              { label: t.ai_analytics_service, target: 'screener' as const },
              { label: t.trading_simulator_service, target: 'simulator' as const },
              { label: t.affiliate_program_service, target: 'affiliate' as const },
            ].map((item, idx) => (
              <li key={idx}>
                <a 
                  href="#" 
                  onClick={(e) => handleProductClick(e, item.target as any)}
                  className="flex items-center gap-3 p-1.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all group"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Check size={12} className="text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-white text-[11px] font-bold leading-tight line-clamp-1">
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal & Social Section */}
        <div className="md:col-span-4 flex flex-col justify-between py-1">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
                {t.legal || 'Legal'}
              </h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => onOpenLegal?.('privacy')}
                    className="text-gray-500 hover:text-white text-[11px] font-bold transition-colors w-full text-left"
                  >
                    {t.privacy_policy_footer}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => onOpenLegal?.('terms')}
                    className="text-gray-500 hover:text-white text-[11px] font-bold transition-colors w-full text-left"
                  >
                    {t.terms_conditions}
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
                Social
              </h4>
              <a 
                href="https://t.me/tiger_trade_official" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-fit text-gray-400 hover:text-white transition-all group"
              >
                <Send size={12} className="text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-wider">Telegram</span>
              </a>
            </div>
          </div>

          <p className="text-gray-600 text-[10px] font-medium leading-relaxed mt-4">
            {t.footer_desc}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 pt-4 border-t-4 border-white/40 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-[9px] text-gray-700 font-black uppercase tracking-widest">
          © 2026 SMARTEYE INTELLIGENCE. ALL RIGHTS RESERVED.
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[9px] text-gray-700 font-black uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
            SYSTEM STATUS: OPERATIONAL
          </span>
        </div>
      </div>
    </footer>
  );
};
