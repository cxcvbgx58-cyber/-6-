import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { Language } from '../../translations';

interface LanguageSwitcherProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ language, setLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all min-w-[60px] sm:min-w-[110px] justify-between group"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Globe size={14} className="text-white transition-colors" />
          <span className="text-white">{language === 'ru' ? 'RU' : 'EN'}</span>
        </div>
        <ChevronDown size={12} className={`text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-full bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[10001] animate-in fade-in zoom-in-95 duration-200 divide-y divide-white/10">
          <button
            onClick={() => {
              setLanguage('en');
              setIsOpen(false);
            }}
            className={`w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-left transition-colors hover:bg-white/10 ${language === 'en' ? 'text-white bg-white/10' : 'text-white/70'}`}
          >
            English
          </button>
          <button
            onClick={() => {
              setLanguage('ru');
              setIsOpen(false);
            }}
            className={`w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-left transition-colors hover:bg-white/10 ${language === 'ru' ? 'text-white bg-white/10' : 'text-white/70'}`}
          >
            Русский
          </button>
        </div>
      )}
    </div>
  );
};
