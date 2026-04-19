import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ExternalLink, HelpCircle, BookOpen, Zap, Shield } from 'lucide-react';

interface GuideItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  icon: React.ReactNode;
}

const GUIDE_DATA: GuideItem[] = [
  {
    id: '1',
    category: 'ОСНОВЫ',
    question: 'ЧТО ТАКОЕ SMARTEYE?',
    answer: 'SmartEye — это стратегия и набор инструментов для анализа рыночных данных в реальном времени. Наша платформа объединяет данные из Binance и Bybit, предоставляя глубокий анализ стаканов (Orderbook), объемов и ценовых движений для поиска прибыльных точек входа.',
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: '2',
    category: 'ИНСТРУМЕНТЫ',
    question: 'КАК РАБОТАЕТ СКРИНЕР?',
    answer: 'Скринер автоматически сканирует сотни торговых пар на Binance и Bybit. Он фильтрует монеты по заданным параметрам: изменению цены, объему и плотностям в стакане. Вы можете быстро переключаться между Spot и Futures рынками для поиска лучших возможностей.',
    icon: <BookOpen className="w-4 h-4" />
  },
  {
    id: '3',
    category: 'БЕЗОПАСНОСТЬ',
    question: 'НУЖНЫ ЛИ API КЛЮЧИ?',
    answer: 'Для базового использования скринера и просмотра графиков API ключи не требуются. Платформа использует публичные WebSocket потоки бирж. Ваши личные данные и ключи (если вы добавите их в будущем для торговли) хранятся только локально или в зашифрованном виде.',
    icon: <Shield className="w-4 h-4" />
  },
  {
    id: '4',
    category: 'ДАННЫЕ',
    question: 'ПОЧЕМУ BYBIT ТРЕБУЕТ ВРЕМЯ?',
    answer: 'Bybit API требует получения полного снимка стакана (Snapshot) перед началом трансляции изменений (Deltas). Наша система кэширует эти снимки на сервере, чтобы вы получали актуальные данные мгновенно при переключении между вкладками.',
    icon: <HelpCircle className="w-4 h-4" />
  },
  {
    id: '5',
    category: 'ИНТЕРФЕЙС',
    question: 'КАК ЧИТАТЬ СТАКАН?',
    answer: 'В стакане отображаются лимитные заявки на покупку (Bids) и продажу (Asks). Мы подсвечиваем крупные плотности, которые могут выступать уровнями поддержки или сопротивления. Чем ярче полоса, тем больше объем на данном ценовом уровне.',
    icon: <ChevronDown className="w-4 h-4" />
  }
];

export const Guide: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-xs font-mono tracking-[0.2em] text-purple-400/60 uppercase">
          Документация
        </h2>
        <h1 className="text-4xl font-mono font-bold text-white tracking-tight">
          РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GUIDE_DATA.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={false}
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            className={`
              relative cursor-pointer overflow-hidden
              bg-[#0a0a0a] border border-purple-500/10 rounded-[2rem]
              p-6 transition-all duration-300 group
              hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.05)]
              ${expandedId === item.id ? 'md:col-span-2 lg:col-span-2 ring-1 ring-purple-500/20' : ''}
            `}
          >
            {/* Background Glow Effect */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-600/5 blur-[60px] rounded-full group-hover:bg-purple-600/10 transition-colors" />

            <div className="flex flex-col h-full space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono tracking-widest text-purple-400/50 uppercase">
                    {item.category}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-purple-500/30" />
                  <span className="text-[10px] font-mono text-white/30">
                    ID-{item.id.padStart(3, '0')}
                  </span>
                </div>
                <div className="text-purple-400/40 group-hover:text-purple-400 transition-colors">
                  {expandedId === item.id ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform" /> : <ExternalLink className="w-4 h-4" />}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-mono font-medium text-white leading-tight group-hover:text-purple-100 transition-colors">
                  {item.question}
                </h3>
              </div>

              <AnimatePresence mode="wait">
                {expandedId === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="pt-4 border-t border-purple-500/10"
                  >
                    <p className="text-sm font-sans text-white/60 leading-relaxed">
                      {item.answer}
                    </p>
                    <div className="mt-6 flex items-center space-x-4">
                      <button className="px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-full text-[10px] font-mono text-purple-400 transition-all">
                        ПОДРОБНЕЕ
                      </button>
                      <button className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors">
                        СВЯЗАТЬСЯ С ПОДДЕРЖКОЙ
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}

        {/* Placeholder for "Coming Soon" or Stats style block as in the image */}
        <div className="bg-[#0a0a0a] border border-purple-500/5 rounded-[2rem] p-6 flex flex-col justify-center items-center space-y-2 opacity-40 grayscale">
           <HelpCircle className="w-8 h-8 text-purple-500/20" />
           <span className="text-[10px] font-mono tracking-widest text-white/20 uppercase">
             Скоро новые разделы
           </span>
        </div>
      </div>
    </div>
  );
};
