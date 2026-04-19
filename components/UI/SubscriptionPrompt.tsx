import React from 'react';
import { X, CreditCard, Star } from 'lucide-react';
import { translations } from '../../src/translations';

interface SubscriptionPromptProps {
  onClose: () => void;
  onNavigateToSubscription: (tab: 'subscription', plan: '1month') => void;
  language: 'ru' | 'en';
}

export const SubscriptionPrompt: React.FC<SubscriptionPromptProps> = ({ onClose, onNavigateToSubscription, language }) => {
  const isRu = language === 'ru';
  const t = translations[language];

  return (
    <div className="fixed bottom-6 left-6 z-[10000] w-[460px] bg-[#111111]/95 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-bottom-10 duration-500 p-[3px] bg-gradient-to-r from-white via-purple-500 to-white backdrop-blur-3xl">
      <div className="bg-[#111111]/90 rounded-[calc(1.5rem-2px)] w-full h-full p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white tracking-tight font-rounded">
            {isRu ? 'Требуется подписка' : 'Subscription required'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Horizontal Plan Block */}
          <div className="flex-1 group relative flex items-center gap-5 p-4 rounded-2xl transition-all duration-500 border bg-[#121215]/95 border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
            <div className="absolute top-0 right-0 bg-[#ff4d4d] px-3 py-1 rounded-tr-2xl rounded-bl-xl shadow-lg z-20">
              <div className="text-white text-[10px] font-black uppercase tracking-wider">
                -24%
              </div>
            </div>
            
            <div className="flex items-start gap-1.5">
              <span className="text-3xl font-black text-white tracking-tighter">$19</span>
              <div className="relative -mt-0.5">
                <span className="text-sm text-gray-500 font-black leading-none tracking-tighter">$25</span>
                <div className="absolute top-1/2 left-[-10%] w-[120%] h-[1.5px] bg-red-500/70 -rotate-12 origin-center" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white truncate tracking-tight">{t.month_1}</div>
              <div className="text-[10px] text-gray-400 font-bold truncate">{t.basic_access}</div>
            </div>
          </div>
          
          <button 
            onClick={() => {
              onNavigateToSubscription('subscription', '1month');
              onClose();
            }}
            className="px-8 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.15em] rounded-xl transition-all shadow-lg shadow-white/5 hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            {isRu ? 'Оплатить' : 'Pay Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

