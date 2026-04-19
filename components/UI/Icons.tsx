
import React from 'react';

export const Logo: React.FC<{ animate?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl'; hideText?: boolean; textBreakpoint?: string; noShadow?: boolean }> = ({ animate, size = 'md', hideText = false, textBreakpoint = 'md', noShadow = false }) => {
  const isLarge = size === 'lg' || size === 'xl';
  const containerClass = isLarge ? "flex flex-col items-center gap-4" : "flex items-center gap-4";
  const logoUrl = "https://preview.redd.it/6ot8qxpia8vg1.png?auto=webp&s=fd5ccf0012e310775af0fc0f189a33f8efb9d753";
  
  return (
    <div className={`${containerClass} cursor-pointer select-none group`}>
      <div className={`${size === 'xl' ? 'w-36 h-36' : isLarge ? 'w-48 h-48' : 'w-12 h-12'} relative flex items-center justify-center transition-transform duration-500 group-hover:scale-110`}>
        <img 
          src={logoUrl} 
          alt="SmartEye Logo" 
          className={`w-full h-full object-contain ${!noShadow ? 'drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]' : ''} ${animate ? 'animate-pulse' : ''}`}
          referrerPolicy="no-referrer"
        />
      </div>

      {!hideText && (
        <div className={`flex flex-col ${isLarge ? 'items-center text-center mt-6' : 'items-start'} leading-none`}>
          <span className={`${size === 'xl' ? 'text-4xl' : isLarge ? 'text-6xl' : 'text-xl'} font-rajdhani font-bold tracking-[0.2em] text-white uppercase`}>
            SmartEye
          </span>
          <span className={`${size === 'xl' ? 'text-[10px] mt-2' : isLarge ? 'text-xs mt-4' : 'text-[9px]'} font-mono text-gray-500 tracking-[0.8em] uppercase font-black`}>
            Crypto Screener
          </span>
        </div>
      )}
    </div>
  );
};

export const CheckCircle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const XCircle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const Spinner = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const EyeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export const EyeOffIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
  </svg>
);

export const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
  </svg>
);

export const DiscordIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037 19.736 19.736 0 00-4.885 1.515.069.069 0 00-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.862-1.297 1.197-1.99a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.863-.886.077.077 0 01-.008-.128c.125-.094.248-.192.366-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.118.098.241.196.366.29a.077.077 0 01-.008.128 13.107 13.107 0 01-1.863.886.076.076 0 00-.041.106c.335.693.735 1.36 1.197 1.99a.078.078 0 00.084.028 19.83 19.83 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const MetaMaskIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 235" fill="none">
    <path d="M238.5 101.4l-14.8-54.8-63.5-38L128 0 95.8 8.6l-63.5 38-14.8 54.8 77.2 46.5L128 163l33.3-15.1 77.2-46.5z" fill="#E17726" />
    <path d="M17.5 101.4l14.8-54.8 63.5-38L128 0l32.2 8.6 63.5 38 14.8 54.8-77.2 46.5L128 163l-33.3-15.1-77.2-46.5z" fill="#E27625" />
    <path d="M128 234.3l70-34.5-22.1-13.5-47.9 14.7 4.2-12.8-5.3 1.6-4.2 12.8L128 234.3z" fill="#E17726" />
  </svg>
);

export const MailIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export const LockIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export const UserIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const HumanIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export const AIIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ai-silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E2E2E2" />
        <stop offset="50%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#9A9A9A" />
      </linearGradient>
    </defs>
    <path 
      d="M50 5 L85 25 L85 70 L98 95 L70 82 L50 95 L15 75 L15 25 Z" 
      stroke="url(#ai-silver-grad)" 
      strokeWidth="6" 
      strokeLinejoin="round"
    />
    <g stroke="url(#ai-silver-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <g key={angle} transform={`rotate(${angle}, 50, 50)`}>
          <path d="M50 25 L65 33 L65 50 L55 55" />
        </g>
      ))}
    </g>
  </svg>
);

export const CandlestickPlusIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* First candle (tall) */}
    <path d="M6 4V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
    
    {/* Second candle (short) */}
    <path d="M12 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <rect x="10.5" y="5" width="3" height="4" rx="0.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>

    {/* Third candle (medium) */}
    <path d="M18 6V16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <rect x="16.5" y="8" width="3" height="5" rx="0.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
    
    {/* Plus sign at the bottom */}
    <path d="M12 18V23M9.5 20.5H14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const AddChartIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {/* Chart Frame */}
    <rect x="2" y="2" width="20" height="14" rx="2" strokeWidth={2} />
    
    {/* Candlestick 1 */}
    <line x1="7" y1="4" x2="7" y2="14" />
    <rect x="5.5" y="6" width="3" height="5" rx="0.5" fill="currentColor" fillOpacity={0.3} />
    
    {/* Candlestick 2 */}
    <line x1="12" y1="4" x2="12" y2="14" />
    <rect x="10.5" y="8" width="3" height="4" rx="0.5" />
    
    {/* Candlestick 3 */}
    <line x1="17" y1="4" x2="17" y2="14" />
    <rect x="15.5" y="5" width="3" height="6" rx="0.5" fill="currentColor" fillOpacity={0.3} />
    
    {/* Plus sign at the bottom */}
    <path d="M12 18v5M9.5 20.5h5" strokeWidth={2.5} />
  </svg>
);
