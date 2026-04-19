
import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon, Spinner, CheckCircle, XCircle } from './Icons';
import { BINANCE_ICON, BYBIT_ICON } from '../../src/constants';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage { id: number; message: string; type: ToastType; }

export const ExchangeLogo = React.memo(({ exchange, size, variant = 'framed' }: { exchange: 'Binance' | 'Bybit'; size?: string; variant?: 'framed' | 'plain' }) => {
  const src = exchange === 'Binance' ? BINANCE_ICON : BYBIT_ICON;
  const isBybit = exchange === 'Bybit';
  const containerSize = size || "w-18 h-8";

  if (variant === 'plain') {
    return (
      <div className={`${containerSize} flex items-center justify-center shrink-0`}>
        <img 
          src={src} 
          alt={exchange} 
          className={`w-full h-full object-contain ${isBybit ? 'scale-[1.8] px-0.5' : 'p-0.5'}`} 
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`relative ${size ? 'px-1 py-0.5' : 'px-2 py-1'} flex items-center justify-center shrink-0`}>
      {/* Left Bracket */}
      <div className={`absolute top-0 left-0 ${size ? 'w-1' : 'w-1.5'} h-full border-l border-t border-b border-white/30`} />
      {/* Right Bracket */}
      <div className={`absolute top-0 right-0 ${size ? 'w-1' : 'w-1.5'} h-full border-r border-t border-b border-white/30`} />
      
      <div className={`${containerSize} flex items-center justify-center overflow-hidden`}>
        <img 
          src={src} 
          alt={exchange} 
          className={`w-full h-full object-contain ${isBybit ? 'scale-[1.8] px-0.5' : 'p-0.5'}`} 
          loading="lazy"
        />
      </div>
    </div>
  );
});

export const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: number) => void; }> = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
    {toasts.map((toast) => (
      <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-slide-in-right ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : toast.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-400'}`}>
        {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
        {toast.type === 'error' && <XCircle className="w-5 h-5" />}
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>
    ))}
  </div>
);

export const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const score = [password.length >= 8, /\d/.test(password), /[!@#$%^&*()]/.test(password)].filter(Boolean).length;
  return (
    <div className="mt-2.5 flex flex-col gap-1">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3].map(i => <div key={i} className={`flex-1 rounded-full transition-all duration-300 ${score >= i ? (i === 1 ? 'bg-red-500' : i === 2 ? 'bg-orange-500' : 'bg-green-500') : 'bg-slate-700/50'}`}></div>)}
      </div>
      <span className="text-[10px] text-right font-mono text-slate-500 uppercase tracking-wider">{score < 2 ? 'Слабый' : score === 2 ? 'Сильный' : 'Надежный'}</span>
    </div>
  );
};

export const Checkbox: React.FC<{ label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; error?: boolean; }> = ({ label, checked, onChange, error }) => (
  <div className="flex items-center gap-3 cursor-pointer group p-4 bg-[#0d0d1a] border border-white/5 rounded-xl hover:border-white/10 transition-all" onClick={() => onChange(!checked)}>
    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-white/10 border-white/30' : error ? 'bg-red-500/10 border-red-500' : 'bg-transparent border-white/10 group-hover:border-white/30'}`}>
      {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
    </div>
    <div className={`text-[12px] font-bold uppercase tracking-wider select-none leading-tight ${error ? 'text-red-400' : 'text-gray-400 group-hover:text-gray-200 transition-colors'}`}>{label}</div>
  </div>
);

export const Input: React.FC<any> = ({ label, icon, type = 'text', error, hint, isValid, ...props }) => {
  const [show, setShow] = useState(false);
  const isPass = type === 'password';
  return (
    <div className="mb-4 group">
      {label && <label className="block mb-2 text-white text-[11px] font-black uppercase tracking-[0.15em] transition-colors">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors">{icon}</div>}
        <input 
          type={isPass ? (show ? 'text' : 'password') : type} 
          className={`w-full bg-[#0d0d1a] border rounded-xl text-white text-sm placeholder-gray-500 transition-all focus:outline-none focus:bg-[#121225] ${icon ? 'pl-12' : 'pl-4'} pr-12 py-3 ${error ? 'border-red-500/50' : isValid ? 'border-green-500/30 focus:border-green-500/50' : 'border-white/10 focus:border-white/20'}`} 
          {...props} 
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isPass && <button type="button" onClick={() => setShow(!show)} className="text-gray-600 hover:text-white transition-colors">{show ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}</button>}
          {isValid && !isPass && <CheckCircle className="w-5 h-5 text-green-500/50" />}
          {error && !isPass && <XCircle className="w-5 h-5 text-red-500/50" />}
        </div>
      </div>
      {(error || hint) && <div className="mt-2 ml-1"><span className={`text-[10px] font-bold uppercase tracking-wider ${error ? 'text-red-500/70' : 'text-gray-600'}`}>{error || hint}</span></div>}
    </div>
  );
};

export const Button: React.FC<any> = ({ children, variant = 'primary', isLoading, className = '', ...props }) => {
  const base = "w-full py-4 rounded-xl text-sm font-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-[0.1em]";
  const variants = {
    primary: "bg-[#1a1a2e] text-white border border-purple-500/10 hover:bg-[#252540] hover:border-purple-500/20 shadow-lg",
    secondary: "bg-white/5 border border-white/10 text-white hover:bg-white/10",
    ghost: "bg-transparent text-gray-400 hover:text-white",
    social: "bg-[#0d0d1a] border border-purple-500/5 text-white hover:bg-[#1a1a2e] hover:border-purple-500/10"
  };
  return <button className={`${base} ${(variants as any)[variant]} ${className}`} disabled={isLoading} {...props}>{isLoading ? <Spinner className="w-5 h-5" /> : children}</button>;
};
