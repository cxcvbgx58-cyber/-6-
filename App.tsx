import React, { useState, useEffect, useMemo } from 'react';
import Dashboard from './components/Dashboard';
import ProfilePage from './components/ProfilePage';
import { AuthMode } from './types';
import { Logo } from './components/UI/Icons';
import { AuthCard } from './components/Auth/AuthForms';
import { ToastContainer, ToastMessage, ToastType } from './components/UI/Shared';
import { Language, translations } from './src/translations';
import { Globe, X } from 'lucide-react';
import { SmarteyeEngineService, CONFIG } from './services/smarteye-engine.service';
import { apiService } from './services/api.service';
import { DBUser } from './models';

import { LanguageSwitcher } from './src/components/UI/LanguageSwitcher';

const AuthPreviewImage: React.FC<{ src: string; alt: string; label: string }> = ({ src, alt, label }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div className="relative group flex flex-col gap-3">
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-500"></div>
      <div className="relative overflow-hidden rounded-xl bg-white/5 aspect-[16/10] sm:aspect-video">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
          </div>
        )}
        <img 
          src={src} 
          alt={alt} 
          onLoad={() => setIsLoaded(true)}
          className={`rounded-xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] w-full h-auto transition-all duration-1000 group-hover:scale-[1.02] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
        />
        {isLoaded && (
          <div className="absolute bottom-4 left-4 bg-white px-4 py-1.5 rounded-full shadow-lg animate-in fade-in duration-500">
            <span className="text-sm font-bold tracking-wider uppercase text-black">
              {label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile'>('dashboard');
  const [profileTab, setProfileTab] = useState<'profile' | 'subscription' | 'affiliate' | 'guide'>('profile');
  const [profilePlan, setProfilePlan] = useState<'1month' | '3months' | '1year'>('1year');
  const [dashboardTab, setDashboardTab] = useState<'screener' | 'market'>('market');
  const [userEmail, setUserEmail] = useState('');
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(AuthMode.LOGIN);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('se_lang');
    return (saved as Language) || 'ru';
  });

  const refreshUser = async () => {
    try {
      const user = await apiService.getMe();
      setDbUser(user);
      setUserEmail(user.email);
      
      // Update local state from DB
      if (user.subscription_tier === 'whale') setSubscriptionTier('whale');
      else if (user.subscription_tier === 'pro') setSubscriptionTier('pro');
      else setSubscriptionTier('free');
      
      setAvatarTier((user.avatar_tier as any) || 'free');
      if (user.premium_end_date) setPremiumEndDate(user.premium_end_date);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Handle referral links
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/ref/')) {
      const refId = path.split('/ref/')[1];
      if (refId && refId !== 'guest') {
        localStorage.setItem('se_referrer_id', refId);
        // Clear the URL without reloading
        window.history.replaceState({}, document.title, '/');
        showToast(language === 'ru' ? 'Реферальный код активирован' : 'Referral code activated', 'info');
      }
    }
  }, [language]);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('.overflow-y-auto').forEach(el => el.scrollTop = 0);
    
    // Refresh user data when returning to dashboard to ensure latest subscription status
    if (currentView === 'dashboard' && isAuthenticated) {
      refreshUser();
    }
  }, [currentView, isAuthenticated]);

  // Subscription state lifted from ProfilePage
  const [avatarTier, setAvatarTier] = useState<'free' | '1month' | '3months' | '1year'>(() => {
    return (localStorage.getItem('se_avatar_tier') as any) || 'free';
  });
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'whale'>(() => {
    return (localStorage.getItem('se_sub_tier') as any) || 'free';
  });
  const [premiumEndDate, setPremiumEndDate] = useState(() => {
    return localStorage.getItem('se_premium_end') || '';
  });

  useEffect(() => {
    localStorage.setItem('se_avatar_tier', avatarTier);
    localStorage.setItem('se_sub_tier', subscriptionTier);
    localStorage.setItem('se_premium_end', premiumEndDate);
  }, [avatarTier, subscriptionTier, premiumEndDate]);

  const engineRef = useMemo(() => new SmarteyeEngineService(), []);

  // Pre-load auth preview images
  useEffect(() => {
    const images = [
      "https://preview.redd.it/w1m09a1ud8vg1.png?width=1080&crop=smart&auto=webp&s=0d415b2aead48fb2d00224d2b30f65b657087e47",
      "https://preview.redd.it/mxho2xtyd8vg1.png?width=1080&crop=smart&auto=webp&s=f113051c7942cb8f2bb1908c0258d05a505ff7be"
    ];
    images.forEach(src => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const sub = engineRef.error$.subscribe(err => {
      const t = translations[language];
      if (err.isRegionalBlock) {
        if (err.message === 'ALL_ALTERNATIVES_FAILED') {
          showToast(t.all_alts_failed.replace('{exchange}', err.exchange), 'error');
        } else {
          showToast(t.regional_block_desc.replace('{exchange}', err.exchange), 'error');
        }
      } else {
        showToast(`${err.exchange} (${err.marketType}): ${err.message}`, 'error');
      }
    });
    return () => sub.unsubscribe();
  }, [engineRef, language]);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem('se_lang', language);
  }, [language]);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('se_auth_token');
      if (savedToken) {
        try {
          const user = await apiService.getMe();
          setDbUser(user);
          setUserEmail(user.email);
          setIsAuthenticated(true);
          
          // Update local state from DB
          if (user.subscription_tier === 'whale') setSubscriptionTier('whale');
          else if (user.subscription_tier === 'pro') setSubscriptionTier('pro');
          
          if (user.avatar_tier) setAvatarTier(user.avatar_tier as any);
          if (user.premium_end_date) setPremiumEndDate(user.premium_end_date);
        } catch (error) {
          console.error('Session check failed:', error);
          handleLogout();
        }
      }
    };
    checkAuth();
  }, []);

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleLoginSuccess = (user: DBUser) => {
    setDbUser(user);
    setUserEmail(user.email);
    setIsAuthenticated(true);
    
    if (user.subscription_tier === 'whale') setSubscriptionTier('whale');
    else if (user.subscription_tier === 'pro') setSubscriptionTier('pro');
    
    if (user.avatar_tier) setAvatarTier(user.avatar_tier as any);
    if (user.premium_end_date) setPremiumEndDate(user.premium_end_date);
  };

  const handleLogout = () => {
    apiService.setToken(null);
    setIsAuthenticated(false);
    setDbUser(null);
    setUserEmail('');
    setAvatarTier('free');
    setSubscriptionTier('free');
    setPremiumEndDate('');
    setCurrentView('dashboard');
    setShowAuthModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-auto overflow-y-auto bg-[#0a0a0a] text-white custom-scroll overscroll-behavior-none">
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(t => t.filter(x => x.id !== id))} />

      {currentView === 'profile' && isAuthenticated ? (
        <ProfilePage 
          onBack={(tab) => {
            if (tab) setDashboardTab(tab);
            setCurrentView('dashboard');
          }} 
          onLogout={handleLogout}
          language={language} 
          avatarTier={avatarTier}
          setAvatarTier={setAvatarTier}
          subscriptionTier={subscriptionTier}
          setSubscriptionTier={setSubscriptionTier}
          premiumEndDate={premiumEndDate}
          setPremiumEndDate={setPremiumEndDate}
          dbUser={dbUser}
          initialTab={profileTab}
          initialPlan={profilePlan}
          refreshUser={refreshUser}
        />
      ) : (
        <Dashboard 
          onNavigateToProfile={(tab, plan) => {
            if (!isAuthenticated) {
              setShowAuthModal(true);
              return;
            }
            if (tab) setProfileTab(tab as any);
            else setProfileTab('profile');
            
            if (plan) setProfilePlan(plan as any);
            else setProfilePlan('1year');
            
            setCurrentView('profile');
          }} 
          onLogout={handleLogout}
          language={language}
          setLanguage={setLanguage}
          engine={engineRef}
          avatarTier={isAuthenticated ? avatarTier : 'free'}
          subscriptionTier={isAuthenticated ? subscriptionTier : 'free'}
          dbUser={dbUser}
          activeTab={dashboardTab}
          setActiveTab={setDashboardTab}
          refreshUser={refreshUser}
          onAuthRequired={() => setShowAuthModal(true)}
          showToast={showToast}
        />
      )}

      {/* Auth Modal Overlay */}
      {(!isAuthenticated && showAuthModal) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAuthModal(false)}></div>
          
          <main className="relative z-10 w-full flex items-center justify-center pointer-events-none px-4 max-w-[1600px] mx-auto">
            {/* Desktop Preview Images */}
            <div className="hidden lg:flex flex-col gap-10 mr-16 xl:mr-24 2xl:mr-32 w-full max-w-[450px] xl:max-w-[600px] 2xl:max-w-[750px] pointer-events-auto animate-in slide-in-from-left-10 duration-700">
              <AuthPreviewImage 
                src="https://preview.redd.it/w1m09a1ud8vg1.png?width=1080&crop=smart&auto=webp&s=0d415b2aead48fb2d00224d2b30f65b657087e47"
                alt="Density Screener"
                label={language === 'ru' ? 'Скринер плотностей' : 'Density Screener'}
              />
              <AuthPreviewImage 
                src="https://preview.redd.it/mxho2xtyd8vg1.png?width=1080&crop=smart&auto=webp&s=f113051c7942cb8f2bb1908c0258d05a505ff7be"
                alt="Coin Screener"
                label={language === 'ru' ? 'Скринер монет' : 'Coin Screener'}
              />
            </div>

            <div className="flex flex-col items-center animate-scale-in pointer-events-auto">
              {/* Mobile View: Solid Background Tab (Hidden on Desktop) */}
              <div className="sm:hidden w-full max-w-[440px] flex flex-col gap-4">
                <div className="bg-[#0d0d1a] border border-white/10 rounded-3xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
                  <div className="absolute top-4 right-4 z-20">
                    <button onClick={() => setShowAuthModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  <AuthCard 
                    authMode={authMode} 
                    setAuthMode={setAuthMode} 
                    onLoginSuccess={(user: DBUser) => {
                      handleLoginSuccess(user);
                      setShowAuthModal(false);
                    }}
                    showToast={showToast}
                    language={language}
                  />
                </div>
              </div>

              {/* Desktop View: Card */}
              <div className="hidden sm:block w-full min-w-[460px] max-w-[500px] bg-[#0d0d1a] border border-white/10 rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_30px_rgba(255,255,255,0.02)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>
                <div className="absolute top-4 right-4 z-20">
                  <button onClick={() => setShowAuthModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <AuthCard 
                  authMode={authMode} 
                  setAuthMode={setAuthMode} 
                  onLoginSuccess={(user: DBUser) => {
                    handleLoginSuccess(user);
                    setShowAuthModal(false);
                  }}
                  showToast={showToast}
                  language={language}
                />
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
