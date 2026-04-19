import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Calendar, CheckCircle, Star, Link as LinkIcon, ExternalLink, Shield, MessageCircle, ArrowLeft, Copy, BookOpen, Users, Check, Globe, CreditCard, Bitcoin, Zap, CircleDot, Lock, LogOut, Search, FileText, ChevronRight, Wallet, MousePointerClick, TrendingUp, Clock, Info, AlertCircle, RotateCcw, History as HistoryIcon, Send, CheckCircle2, Headset, Activity, Bell, PlayCircle, LayoutGrid, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Language, translations } from '../src/translations';
import { SubscriptionAvatar } from './UI/SubscriptionAvatar';
import { Logo } from './UI/Icons';
import { Footer } from './UI/Footer';
import { LegalModal } from './UI/LegalModal';
import { partnerService, ReferralData, EarningReport } from '../services/partner.service';
import { apiService } from '../services/api.service';
import { supportService } from '../services/support.service';
import { DBUser, PremiumPurchase, Referral, SupportMessage } from '../models';

interface ProfilePageProps {
  onBack: (tab?: 'screener' | 'market') => void;
  onLogout: () => void;
  language: Language;
  avatarTier: 'free' | '1month' | '3months' | '1year';
  setAvatarTier: (tier: 'free' | '1month' | '3months' | '1year') => void;
  subscriptionTier: 'free' | 'pro' | 'whale';
  setSubscriptionTier: (tier: 'free' | 'pro' | 'whale') => void;
  premiumEndDate: string;
  setPremiumEndDate: (date: string) => void;
  dbUser: DBUser | null;
  initialTab?: 'profile' | 'subscription' | 'affiliate' | 'guide';
  initialPlan?: '1month' | '3months' | '1year';
  refreshUser: () => Promise<void>;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ 
  onBack, 
  onLogout,
  language, 
  avatarTier, 
  setAvatarTier, 
  subscriptionTier, 
  setSubscriptionTier, 
  premiumEndDate, 
  setPremiumEndDate,
  dbUser,
  initialTab = 'profile',
  initialPlan = '1year',
  refreshUser
}) => {
  const t = translations[language];
  const [userEmail] = useState(dbUser?.email || 'user@example.com');
  const [joinDate] = useState(dbUser ? new Date(dbUser.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US') : t.join_date_val);
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'affiliate' | 'guide'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [paymentError, setPaymentError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'1month' | '3months' | '1year'>(initialPlan);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'crypto' | 'telegram_stars' | null>(null);
  const [userId, setUserId] = useState(dbUser?.id || `ID-${Math.floor(Math.random() * 1000000)}`);
  
  useEffect(() => {
    if (dbUser?.id) {
      setUserId(dbUser.id);
    }
  }, [dbUser]);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isPaymentSuccessOpen, setIsPaymentSuccessOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSupportModalOpen && dbUser) {
      supportService.initialize(dbUser.id);
      const sub = supportService.messages$.subscribe(msgs => {
        setSupportMessages(msgs);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      });
      return () => {
        sub.unsubscribe();
        supportService.disconnect();
      };
    }
  }, [isSupportModalOpen, dbUser]);

  const handleSendSupport = async () => {
    if (!dbUser || !supportMessage.trim() || isSendingSupport) return;
    setIsSendingSupport(true);
    try {
      await supportService.sendMessage(dbUser.id, supportMessage);
      setSupportMessage('');
    } catch (err: any) {
      console.error('Support send error:', err);
      alert(language === 'ru' ? `Ошибка при отправке: ${err.message}` : `Send error: ${err.message}`);
    } finally {
      setIsSendingSupport(false);
    }
  };

  // Partner Data States
  const [premiumHistory, setPremiumHistory] = useState<PremiumPurchase[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earningsSummary, setEarningsSummary] = useState({ total_earnings: 25.0, total_withdrawn: 0, available_balance: 25.0 });
  const [isLoadingPartnerData, setIsLoadingPartnerData] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // Fetch Partner Data
  useEffect(() => {
    if (activeTab === 'affiliate' && dbUser) {
      const fetchPartnerData = async () => {
        setIsLoadingPartnerData(true);
        setPartnerError(null);
        try {
          const [history, refs, summary] = await Promise.all([
            apiService.getPremiumHistory(dbUser.id),
            apiService.getReferrals(dbUser.id),
            apiService.getEarningsSummary(dbUser.id)
          ]);
          setPremiumHistory(history);
          setReferrals(refs);
          setEarningsSummary(summary);
        } catch (error: any) {
          console.error('Failed to fetch partner data:', error);
          setPartnerError(language === 'ru' ? `Не удалось получить данные о партнерах: ${error.message}` : `Failed to fetch partner data: ${error.message}`);
        } finally {
          setIsLoadingPartnerData(false);
        }
      };
      fetchPartnerData();
    }
  }, [activeTab, dbUser]);

  // Initialize premiumEndDate if empty
  useEffect(() => {
    if (!premiumEndDate) {
      setPremiumEndDate(t.no_active_subscription);
    }
  }, [premiumEndDate, t.no_active_subscription, setPremiumEndDate]);

  const handlePayment = () => {
    if (!selectedMethod) {
      setPaymentError(true);
      return;
    }
    setPaymentError(false);

    if (selectedMethod === 'telegram_stars') {
      const rawBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || (process.env as any).VITE_TELEGRAM_BOT_USERNAME || 'smarteye_screener_bot';
      const botUsername = rawBotUsername.replace('@', '');
      const deepLink = `https://t.me/${botUsername}?start=pay_${userId}_${selectedPlan}`;
      
      console.log('Initiating Telegram payment:', { botUsername, userId, selectedPlan, deepLink });

      // Use a link element for more reliable redirection in iframes/mobile
      const a = document.createElement('a');
      a.href = deepLink;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      
      try {
        a.click();
      } catch (err) {
        console.error('Redirection via click failed, fallback to location.href:', err);
        window.location.href = deepLink;
      }
      
      document.body.removeChild(a);
      return;
    }
    
    setAvatarTier(selectedPlan);
    setPremiumEndDate(plans[selectedPlan].endDate);
    const newTier = selectedPlan === '1year' ? 'whale' : 'pro';
    const newEndDate = plans[selectedPlan].endDate;
    setSubscriptionTier(newTier);
    
    // Save to DB
    if (dbUser) {
      const months = selectedPlan === '1month' ? 1 : selectedPlan === '3months' ? 3 : 12;
      apiService.simulatePurchase({
        userId: dbUser.id,
        planTier: selectedPlan === '1year' ? 'whale' : 'pro',
        amount: plans[selectedPlan].price,
        months
      }).then(async () => {
        // Refresh user data to unlock features
        await refreshUser();
        
        // Refresh history if we are on affiliate tab or after purchase
        if (activeTab === 'affiliate') {
          apiService.getPremiumHistory(dbUser.id).then(setPremiumHistory);
        }
      }).catch(err => {
        console.error('Failed to update subscription in DB:', err);
      });
    }
    
    // Trigger confetti celebration
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
    
    setIsPaymentSuccessOpen(true);
  };

  const avatarTiers: ('free' | '1month' | '3months' | '1year')[] = ['free', '1month', '3months', '1year'];

  const plans = {
    '1month': {
      id: '1month',
      name: t.plan_1month,
      period: t.plan_1month,
      price: 19,
      starsPrice: 100,
      displayPrice: '$19',
      originalPrice: '$25',
      discount: '24%',
      endDate: language === 'ru' ? '27 апреля 2026 г.' : 'April 27, 2026'
    },
    '3months': {
      id: '3months',
      name: t.plan_3months,
      period: t.plan_3months,
      price: 49,
      starsPrice: 250,
      displayPrice: '$49',
      originalPrice: '$75',
      discount: '35%',
      endDate: language === 'ru' ? '27 июня 2026 г.' : 'June 27, 2026'
    },
    '1year': {
      id: '1year',
      name: t.plan_1year,
      period: t.plan_1year,
      price: 174,
      starsPrice: 900,
      displayPrice: '$174',
      originalPrice: '$300',
      discount: '42%',
      endDate: language === 'ru' ? '27 марта 2027 г.' : 'March 27, 2027'
    }
  };

  const referralLink = `https://smarteye.app/ref/${dbUser?.id || userId}`;

  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [activeStatsTab, setActiveStatsTab] = useState<'clicks' | 'referrals' | 'unpaid' | 'paid' | 'income' | 'premium_history' | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<'1m' | '6m' | '1y'>('1m');

  useEffect(() => {
    if (activeStatsTab) {
      const element = document.getElementById('stats-details');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeStatsTab]);

  const commissionRates = [
    { tier: language === 'ru' ? '1 Месяц' : '1 Month', price: 19, commission: 3.80 },
    { tier: language === 'ru' ? '3 Месяца' : '3 Months', price: 49, commission: 9.80 },
    { tier: language === 'ru' ? '1 Год' : '1 Year', price: 149, commission: 29.80 },
  ];

  const getDynamicChartData = () => {
    const data = [];
    const now = new Date();
    let points = 7;
    let daysBack = 30;

    if (chartTimeframe === '1m') {
      points = 8;
      daysBack = 30;
    } else if (chartTimeframe === '6m') {
      points = 8;
      daysBack = 180;
    } else if (chartTimeframe === '1y') {
      points = 8;
      daysBack = 365;
    }

    const step = Math.floor(daysBack / (points - 1));

    for (let i = points - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (i * step));
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      
      data.push({
        name: `${day}.${month}`,
        clicks: Math.floor(Math.random() * 50) + 10,
        referrals: Math.floor(Math.random() * 5),
        income: Math.floor(Math.random() * 40) + 5,
      });
    }
    return data;
  };

  const dynamicChartData = getDynamicChartData();

  const paymentHistory = [
    { date: '01.04.2026', amount: '$35.00', status: language === 'ru' ? 'Выполнено' : 'Completed' },
    { date: '15.03.2026', amount: '$22.50', status: language === 'ru' ? 'Выполнено' : 'Completed' },
    { date: '01.03.2026', amount: '$48.00', status: language === 'ru' ? 'Выполнено' : 'Completed' },
  ];

  const lastWithdrawDate = paymentHistory[0].date;
  const todayDate = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleWithdraw = async () => {
    if (!withdrawAddress.trim() || !dbUser) return;
    const amount = parseFloat(withdrawAmount);
    const balance = earningsSummary.available_balance;
    
    // Check if user has enough balance
    if (amount > balance) {
      alert(language === 'ru' ? 'Недостаточно средств' : 'Insufficient funds');
      return;
    }

    if (balance < 25) {
      alert(language === 'ru' ? 'Недостаточно средств (Минимальный баланс для вывода $25)' : 'Insufficient funds (Minimum balance for withdrawal is $25)');
      return;
    }

    // Check if amount is valid
    if (isNaN(amount) || amount < 25) {
      alert(language === 'ru' ? 'Минимальная сумма на вывод 25$' : 'Minimum withdrawal amount is $25');
      return;
    }
    
    setIsWithdrawing(true);
    try {
      await apiService.requestWithdrawal({
        userId: dbUser.id,
        amount: amount,
        address: withdrawAddress
      });
      
      setIsWithdrawing(false);
      setWithdrawAddress('');
      setWithdrawAmount('');
      alert(language === 'ru' ? 'Заявка на вывод создана и сохранена в базе!' : 'Withdrawal request created and saved to database!');
    } catch (error) {
      console.error('Withdrawal request failed:', error);
      setIsWithdrawing(false);
      alert(language === 'ru' ? 'Ошибка при создании заявки' : 'Error creating withdrawal request');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTierLocked = (tier: 'free' | '1month' | '3months' | '1year') => {
    if (tier === 'free') return false;
    if (subscriptionTier === 'free') return true;
    if (subscriptionTier === 'pro') {
      return tier === '1year'; // Pro gets 1month and 3months
    }
    return false; // Whale gets everything
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-black text-white relative font-sans selection:bg-purple-500/30 custom-scroll">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/05 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 px-4 md:px-12 lg:px-20 py-4 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onBack()} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-all"><ArrowLeft size={18} /></div>
          </button>
          <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>
          
          <div className="hidden md:flex items-center gap-1 bg-[#0c0c0e]/60 p-1.5 rounded-full border border-white/5 shadow-inner backdrop-blur-xl">
            {[
              { id: 'profile', label: t.profile, icon: User },
              { id: 'subscription', label: t.subscription, icon: Star },
              { id: 'affiliate', label: t.affiliate, icon: Users },
              { id: 'guide', label: t.guide, icon: BookOpen },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-500 backdrop-blur-md ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                    : 'bg-white/[0.03] text-gray-500 hover:text-gray-300 hover:bg-white/[0.08] border border-white/5'
                }`}
              >
                <tab.icon size={14} strokeWidth={2.5} className={activeTab === tab.id ? 'text-white' : 'text-gray-500'} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="grid md:hidden grid-cols-2 gap-1 bg-[#0c0c0e]/60 p-1 rounded-2xl border border-white/5 backdrop-blur-xl w-full landscape:flex landscape:md:hidden landscape:flex-nowrap landscape:rounded-full landscape:w-auto overflow-x-auto no-scrollbar">
            {[
              { id: 'profile', label: t.profile, icon: User },
              { id: 'subscription', label: t.subscription, icon: Star },
              { id: 'affiliate', label: t.affiliate, icon: Users },
              { id: 'guide', label: t.guide, icon: BookOpen },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl landscape:rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                    : 'bg-white/[0.03] text-gray-500 hover:bg-white/10 border border-white/5'
                }`}
              >
                <tab.icon size={12} className={activeTab === tab.id ? 'text-white' : 'text-gray-500'} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-12 lg:px-20 py-8">
        <div className="space-y-6">
          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0 space-y-6">
            {activeTab === 'subscription' && (
              <div className="space-y-12 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left Column: Plans and Features */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Plans Section */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 xl:gap-8">
                      {/* 1 Month */}
                      <div 
                        onClick={() => setSelectedPlan('1month')}
                        className={`group relative flex flex-col p-3 sm:p-8 xl:p-10 rounded-2xl sm:rounded-[2.5rem] xl:rounded-[3rem] transition-all duration-500 cursor-pointer border backdrop-blur-3xl overflow-hidden h-full min-h-[160px] landscape:min-h-[110px] sm:min-h-[260px] sm:landscape:min-h-[180px] xl:min-h-[320px] hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] ${
                          selectedPlan === '1month' 
                          ? 'bg-[#121215]/95 border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.12),0_0_0_1px_rgba(168,85,247,0.2)]' 
                          : 'bg-[#0c0c0e]/90 border-white/10 hover:border-white/20 hover:bg-[#121215]/95'
                        }`}
                      >
                        <div className="absolute top-0 right-0 bg-[#ff4d4d] px-2 py-1 sm:px-4 sm:py-2 xl:px-6 xl:py-3 rounded-tr-2xl sm:rounded-tr-[2.5rem] xl:rounded-tr-[3rem] rounded-bl-lg sm:rounded-bl-[1.5rem] xl:rounded-bl-[2rem] shadow-xl z-20">
                          <div className="text-white text-[7px] sm:text-[9px] xl:text-[11px] font-black uppercase tracking-wider">
                            {t.discount} -24%
                          </div>
                        </div>
                        <div className="relative z-10 mb-4 landscape:mb-2 sm:mb-8 pt-6 landscape:pt-4 sm:pt-10">
                          <div className="flex items-start gap-1 sm:gap-2">
                            <span className="text-xl sm:text-4xl xl:text-6xl font-black text-white tracking-tighter">$19</span>
                            <div className="relative -mt-0.5 sm:-mt-2">
                              <span className="text-[10px] sm:text-[20px] text-gray-400/80 font-black leading-none tracking-tighter">$25</span>
                              <div className="absolute top-1/2 left-[-10%] w-[120%] h-[1px] sm:h-[2px] bg-red-500/70 -rotate-12 origin-center" />
                            </div>
                          </div>
                        </div>
                        <div className="relative z-10 flex-1">
                          <div className="text-xs sm:text-2xl font-black text-white mb-0.5 sm:mb-2 tracking-tight">{t.month_1}</div>
                          <div className="text-[8px] sm:text-sm text-gray-500 font-bold">{t.basic_access}</div>
                        </div>
                        <div className="relative z-10 mt-4 landscape:mt-2 sm:mt-8">
                          <button className={`w-full py-2 sm:py-3.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-500 ${
                            selectedPlan === '1month' 
                            ? 'bg-white text-black shadow-[0_15px_35px_rgba(255,255,255,0.25)]' 
                            : 'bg-white/5 text-gray-400 group-hover:bg-white/10'
                          }`}>
                            {selectedPlan === '1month' ? (
                              <>
                                <span className="hidden sm:inline">{t.selected}</span>
                                <span className="sm:hidden">✓</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">{t.select}</span>
                                <span className="sm:hidden">{t.select}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 3 Months */}
                      <div 
                        onClick={() => setSelectedPlan('3months')}
                        className={`group relative flex flex-col p-3 sm:p-8 xl:p-10 rounded-2xl sm:rounded-[2.5rem] xl:rounded-[3rem] transition-all duration-500 cursor-pointer border backdrop-blur-3xl overflow-hidden h-full min-h-[160px] landscape:min-h-[110px] sm:min-h-[260px] sm:landscape:min-h-[180px] xl:min-h-[320px] hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] ${
                          selectedPlan === '3months' 
                          ? 'bg-[#121215]/95 border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.12),0_0_0_1px_rgba(168,85,247,0.2)]' 
                          : 'bg-[#0c0c0e]/90 border-white/10 hover:border-white/20 hover:bg-[#121215]/95'
                        }`}
                      >
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/10 blur-[100px] group-hover:bg-purple-600/20 transition-all duration-700" />
                        <div className="absolute top-0 right-0 bg-[#ff4d4d] px-2 py-1 sm:px-4 sm:py-2 xl:px-6 xl:py-3 rounded-tr-2xl sm:rounded-tr-[2.5rem] xl:rounded-tr-[3rem] rounded-bl-lg sm:rounded-bl-[1.5rem] xl:rounded-bl-[2rem] shadow-xl z-20">
                          <div className="text-white text-[7px] sm:text-[9px] xl:text-[11px] font-black uppercase tracking-wider">
                            {t.discount} -35%
                          </div>
                        </div>
                        <div className="relative z-10 mb-4 landscape:mb-2 sm:mb-8 pt-6 landscape:pt-4 sm:pt-10">
                          <div className="flex items-start gap-1 sm:gap-2">
                            <span className="text-xl sm:text-4xl xl:text-6xl font-black text-white tracking-tighter">$49</span>
                            <div className="relative -mt-0.5 sm:-mt-2">
                              <span className="text-[10px] sm:text-[20px] text-gray-400/80 font-black leading-none tracking-tighter">$75</span>
                              <div className="absolute top-1/2 left-[-10%] w-[120%] h-[1px] sm:h-[2px] bg-red-500/70 -rotate-12 origin-center" />
                            </div>
                          </div>
                        </div>
                        <div className="relative z-10 flex-1">
                          <div className="text-xs sm:text-2xl font-black text-white mb-0.5 sm:mb-2 tracking-tight">{t.months_3}</div>
                          <div className="text-[8px] sm:text-sm text-gray-400 font-bold">$16 <span className="text-gray-500">{t.per_month}</span></div>
                        </div>
                        <div className="relative z-10 mt-4 landscape:mt-2 sm:mt-8">
                          <button className={`w-full py-2 sm:py-3.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-500 ${
                            selectedPlan === '3months' 
                            ? 'bg-white text-black shadow-[0_15px_35px_rgba(255,255,255,0.25)]' 
                            : 'bg-white/5 text-gray-400 group-hover:bg-white/10'
                          }`}>
                            {selectedPlan === '3months' ? (
                              <>
                                <span className="hidden sm:inline">{t.selected}</span>
                                <span className="sm:hidden">✓</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">{t.select}</span>
                                <span className="sm:hidden">{t.select}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 1 Year */}
                      <div 
                        onClick={() => setSelectedPlan('1year')}
                        className={`group relative flex flex-col p-3 sm:p-8 xl:p-10 rounded-2xl sm:rounded-[2.5rem] xl:rounded-[3rem] transition-all duration-500 cursor-pointer border backdrop-blur-3xl overflow-hidden h-full min-h-[160px] landscape:min-h-[110px] sm:min-h-[260px] sm:landscape:min-h-[180px] xl:min-h-[320px] hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] ${
                          selectedPlan === '1year' 
                          ? 'bg-[#121215]/95 border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.12),0_0_0_1px_rgba(168,85,247,0.2)]' 
                          : 'bg-[#0c0c0e]/90 border-white/10 hover:border-white/20 hover:bg-[#121215]/95'
                        }`}
                      >
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 px-2 py-1 sm:px-4 sm:py-2 xl:px-6 xl:py-3 rounded-tr-2xl sm:rounded-tr-[2.5rem] xl:rounded-tr-[3rem] rounded-bl-lg sm:rounded-bl-[1.5rem] xl:rounded-bl-[2rem] shadow-xl z-20">
                          <div className="text-white text-[7px] sm:text-[9px] xl:text-[11px] font-black uppercase tracking-wider">
                            {t.discount} -42%
                          </div>
                        </div>
                        <div className="relative z-10 mb-4 landscape:mb-2 sm:mb-8 pt-6 landscape:pt-4 sm:pt-10">
                          <div className="flex items-start gap-1 sm:gap-2">
                            <span className="text-xl sm:text-4xl xl:text-6xl font-black text-white tracking-tighter">$174</span>
                            <div className="relative -mt-0.5 sm:-mt-2">
                              <span className="text-[10px] sm:text-[20px] text-gray-400/80 font-black leading-none tracking-tighter">$300</span>
                              <div className="absolute top-1/2 left-[-10%] w-[120%] h-[1px] sm:h-[2px] bg-red-500/70 -rotate-12 origin-center" />
                            </div>
                          </div>
                        </div>
                        <div className="relative z-10 flex-1">
                          <div className="text-xs sm:text-2xl font-black text-white mb-0.5 sm:mb-2 tracking-tight">{t.year_1}</div>
                          <div className="text-[8px] sm:text-sm text-gray-400 font-bold">$14 <span className="text-gray-500">{t.per_month}</span></div>
                        </div>
                        <div className="relative z-10 mt-4 landscape:mt-2 sm:mt-8">
                          <button className={`w-full py-2 sm:py-3.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all duration-500 ${
                            selectedPlan === '1year' 
                            ? 'bg-white text-black shadow-[0_15px_35px_rgba(255,255,255,0.25)]' 
                            : 'bg-white/5 text-gray-400 group-hover:bg-white/10'
                          }`}>
                            {selectedPlan === '1year' ? (
                              <>
                                <span className="hidden sm:inline">{t.selected}</span>
                                <span className="sm:hidden">✓</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">{t.select}</span>
                                <span className="sm:hidden">{t.select}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Features Section */}
                    <div className="bg-[#0c0c0e]/95 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden group backdrop-blur-2xl hover:border-white/20 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.03)] flex-1">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/5 blur-[80px] -mr-24 -mt-24 group-hover:bg-purple-600/10 transition-all duration-1000" />
                      <h3 className="text-2xl font-black text-white mb-6 tracking-tight">
                        {language === 'ru' ? (
                          <>
                            {t.premium_features.split(' ')[0]} <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 bg-clip-text text-transparent">{t.premium_features.split(' ')[1]}</span>
                          </>
                        ) : (
                          <>
                            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 bg-clip-text text-transparent">{t.premium_features.split(' ')[0]}</span> {t.premium_features.split(' ')[1]}
                          </>
                        )}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { title: t.feature_density, desc: t.feature_density_desc },
                          { title: t.feature_ai, desc: t.feature_ai_desc },
                          { title: t.feature_screener, desc: t.feature_screener_desc },
                          { title: t.feature_charts, desc: t.feature_charts_desc },
                          { title: t.feature_alerts, desc: t.feature_alerts_desc },
                          { title: t.feature_simulator, desc: t.feature_simulator_desc },
                        ].map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-md hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 group/item md:min-h-[85px]">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover/item:bg-white/10 transition-all">
                              <Check size={16} className="text-gray-400" strokeWidth={3} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-white tracking-tight leading-tight mb-0.5">
                                {feature.title}
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold leading-tight">
                                {feature.desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                {/* Right Column: Checkout Section */}
                <div className="lg:col-span-4 w-full h-full max-w-md mx-auto lg:max-w-none lg:mx-0 bg-[#0c0c0e]/95 border border-white/10 rounded-[2.5rem] p-6 space-y-6 flex flex-col relative overflow-hidden group backdrop-blur-2xl hover:border-white/20 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/5 blur-[100px] -ml-32 -mb-32 group-hover:bg-purple-600/10 transition-all duration-1000" />
                  <h3 className="text-xl font-black text-white tracking-tight">{t.payment}</h3>
                  
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#0c0c0e]/60 border border-white/5 backdrop-blur-md transition-all">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{t.period_label}</span>
                      <span className="text-xs font-black text-white uppercase tracking-wider">{plans[selectedPlan].period}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[#0c0c0e]/60 border border-white/5 backdrop-blur-md transition-all">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{t.ending_label}</span>
                      <span className="text-xs font-black text-white tracking-tight">{plans[selectedPlan].endDate}</span>
                    </div>
                  </div>

                  <div className="relative z-10 space-y-6">
                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-white uppercase tracking-[0.2em] mb-1 px-1 opacity-60">{t.payment_method_label}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            setSelectedMethod('card');
                            setPaymentError(false);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-300 ${
                            selectedMethod === 'card' 
                            ? 'bg-white border-white shadow-[0_10px_30px_rgba(255,255,255,0.2)] scale-[1.01]' 
                            : 'border-white/10 hover:border-white/30'
                          } backdrop-blur-md`}
                          style={selectedMethod !== 'card' ? {
                            background: 'linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(168,85,247,0.1) 50%, rgba(244,63,94,0.1) 100%)'
                          } : {}}
                        >
                          <CreditCard size={20} className={`flex-shrink-0 transition-colors ${selectedMethod === 'card' ? 'text-black' : 'text-white'}`} />
                          <div className="text-left overflow-hidden">
                            <div className={`text-[10px] font-black tracking-widest truncate ${selectedMethod === 'card' ? 'text-black' : 'text-gray-300'}`}>
                              {t.card}
                            </div>
                            <div className={`text-[8px] font-bold truncate ${selectedMethod === 'card' ? 'text-gray-500' : 'text-gray-500'}`}>Visa, MC, MIR</div>
                          </div>
                        </button>

                        <button 
                          onClick={() => {
                            setSelectedMethod('crypto');
                            setPaymentError(false);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-300 ${
                            selectedMethod === 'crypto' 
                            ? 'bg-white border-white shadow-[0_10px_30px_rgba(255,255,255,0.2)] scale-[1.01]' 
                            : 'border-white/10 hover:border-white/30'
                          } backdrop-blur-md`}
                          style={selectedMethod !== 'crypto' ? {
                            background: 'linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(168,85,247,0.1) 50%, rgba(244,63,94,0.1) 100%)'
                          } : {}}
                        >
                          <Bitcoin size={20} className={`flex-shrink-0 transition-colors ${selectedMethod === 'crypto' ? 'text-black' : 'text-[#F7931A]'}`} />
                          <div className="text-left overflow-hidden">
                            <div className={`text-[10px] font-black tracking-widest truncate ${selectedMethod === 'crypto' ? 'text-black' : 'text-gray-300'}`}>
                              {t.crypto}
                            </div>
                            <div className={`text-[8px] font-bold truncate ${selectedMethod === 'crypto' ? 'text-gray-500' : 'text-gray-500'}`}>USDT, BTC, TON</div>
                          </div>
                        </button>

                        <button 
                          onClick={() => {
                            setSelectedMethod('telegram_stars');
                            setPaymentError(false);
                          }}
                          className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-500 col-span-2 relative overflow-hidden group/tg ${
                            selectedMethod === 'telegram_stars' 
                            ? 'border-white/60 shadow-[0_10px_40px_rgba(255,255,255,0.15)] scale-[1.02]' 
                            : 'border-white/10 hover:border-white/30'
                          }`}
                          style={{
                            background: selectedMethod === 'telegram_stars' 
                              ? 'linear-gradient(135deg, #60a5fa 0%, #a855f7 50%, #f43f5e 100%)'
                              : 'linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(168,85,247,0.1) 50%, rgba(244,63,94,0.1) 100%)',
                            backgroundSize: '200% 200%',
                            animation: 'gradient-x 5s ease infinite'
                          }}
                        >
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.5),transparent)]" />
                          {selectedMethod === 'telegram_stars' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer" />
                          )}
                          <img 
                            src="https://lztcdn.com/files/6514f1e6-dab4-4d49-806a-3ff22d7793e5.webp" 
                            alt="Stars" 
                            className={`w-7 h-7 flex-shrink-0 transition-all duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] ${selectedMethod === 'telegram_stars' ? 'scale-125' : 'scale-100 group-hover/tg:scale-110'}`}
                            referrerPolicy="no-referrer"
                          />
                          <div className="text-center relative z-10">
                            <div className={`text-[13px] font-black tracking-[0.15em] transition-colors drop-shadow-lg ${selectedMethod === 'telegram_stars' ? 'text-white' : 'text-gray-200 group-hover/tg:text-white'}`}>
                              {t.telegram_stars}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="relative group/input">
                        <input 
                          type="text" 
                          placeholder={t.promocode} 
                          className="w-full bg-[#0c0c0e]/80 border border-purple-500/30 rounded-xl px-4 py-4 text-xs text-white focus:outline-none focus:border-purple-500/60 transition-colors pr-24 font-bold placeholder:text-gray-600 backdrop-blur-md"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                        />
                      <button className={`absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all backdrop-blur-md active:scale-95 border ${promoCode ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/10 text-gray-500 border-white/10 group-focus-within/input:bg-white group-focus-within/input:text-black group-focus-within/input:border-white hover:bg-white/20'}`}>
                        {t.apply}
                      </button>
                    </div>

                    <div className="flex items-end justify-between gap-4 flex-wrap">
                      <div className="flex-shrink-0">
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">{t.to_pay}</div>
                        <div className="text-4xl font-black text-white tracking-tighter leading-none whitespace-nowrap flex items-center gap-2">
                          {selectedMethod === 'telegram_stars' ? (
                            <>
                              {plans[selectedPlan].starsPrice}
                              <img 
                                src="https://lztcdn.com/files/6514f1e6-dab4-4d49-806a-3ff22d7793e5.webp" 
                                alt="Stars" 
                                className="w-8 h-8 flex-shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            </>
                          ) : (
                            plans[selectedPlan].displayPrice
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {plans[selectedPlan].originalPrice && (
                          <div className="relative">
                            <span className="text-sm text-gray-400 font-bold leading-none">{plans[selectedPlan].originalPrice}</span>
                            <div className="absolute top-1/2 left-[-10%] w-[120%] h-[1.5px] bg-red-500/60 -rotate-12 origin-center" />
                          </div>
                        )}
                        <div className={`px-3 py-1.5 rounded-tr-2xl rounded-bl-xl shadow-lg flex-shrink-0 ${
                          selectedPlan === '1year' 
                          ? 'bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500' 
                          : 'bg-[#ff4d4d]'
                        }`}>
                          <div className="text-white text-[9px] font-black uppercase tracking-wider">
                            {t.discount} -{plans[selectedPlan].discount || '0%'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 relative z-10 border-t border-white/5 mt-auto space-y-4">
                    <button 
                      onClick={handlePayment}
                      className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 bg-white text-black shadow-[0_15px_40px_rgba(255,255,255,0.15)] hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {t.pay_now}
                    </button>
                    {paymentError && !selectedMethod && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                      >
                        <span className="text-[10px] text-red-500 font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                          {t.select_payment_method}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                <div className="lg:col-span-1 space-y-6">
                  {/* Avatar & Basic Info */}
                  <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center text-center backdrop-blur-2xl transition-all group relative overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.03)] focus-within:ring-2 focus-within:ring-white/20 h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 opacity-50" />
                    
                    <div className="relative mb-6">
                      <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-500 bg-white/5 border-2 border-white/10">
                        <SubscriptionAvatar tier={avatarTier} size={150} padding="p-3 sm:p-4" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 border-4 border-[#0a0a0a] rounded-full shadow-lg z-10" title="Online"></div>
                    </div>

                    <div className="w-full space-y-6 mb-8 py-2">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-1">ID</div>
                        <div className="text-sm text-white font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/5">{userId}</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-1">{language === 'ru' ? 'Почта' : 'Email'}</div>
                        <div className="text-sm text-gray-300 font-medium">{userEmail}</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-1">{language === 'ru' ? 'Имя пользователя' : 'Username'}</div>
                        <div className="text-sm text-white font-bold">{dbUser?.username || 'User'}</div>
                      </div>
                    </div>

                    <div className="mt-8 w-full">
                      <button 
                        onClick={onLogout}
                        className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-red-500 transition-all flex items-center justify-center gap-3 group/logout shadow-lg shadow-red-500/5 hover:shadow-red-500/10"
                      >
                        <LogOut size={16} className="group-hover/logout:-translate-x-1 transition-transform" />
                        {t.exit_btn}
                      </button>
                    </div>
                  </div>
                </div>

              {/* Account Details & Subscription */}
                <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
                  {/* Registration Date & Email Status Block - SWAPPED Up */}
                  <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-6 sm:p-8 backdrop-blur-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.03)] flex-1 flex flex-col justify-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Registration Date Item */}
                      <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 shadow-inner transition-colors hover:border-white/10">
                        <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-gray-400">
                          <Calendar size={24} strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                            {language === 'ru' ? 'ДАТА РЕГИСТРАЦИИ' : 'REGISTRATION DATE'}
                          </div>
                          <div className="text-lg font-black text-white tracking-tight leading-none">
                            24 сентября 2025
                          </div>
                        </div>
                      </div>

                      {/* Email Status Item */}
                      <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 shadow-inner transition-colors hover:border-white/10">
                        <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-gray-400">
                          <CheckCircle size={24} strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                            {language === 'ru' ? 'СТАТУС ПОЧТЫ' : 'EMAIL STATUS'}
                          </div>
                          <div className="text-lg font-black text-white tracking-tight leading-none flex items-center gap-2">
                            {language === 'ru' ? 'Подтверждена' : 'Confirmed'}
                            <Check size={16} className="text-white" strokeWidth={3} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Useful Links - SWAPPED Down */}
                  <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-6 sm:p-8 backdrop-blur-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.03)] flex-1 flex flex-col">
                    <h3 className="text-[12px] sm:text-sm font-black text-gray-500 uppercase tracking-[0.25em] mb-4 sm:mb-6 flex items-center gap-3">
                      <LinkIcon size={16} className="text-gray-600" /> {t.useful_links}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {[
                        { title: 'Telegram', subtitle: language === 'ru' ? 'Наше сообщество' : 'Our Community', icon: <MessageCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />, link: 'https://t.me/+Hm-fim1iQl4yZTEy' },
                        { title: t.read_terms, subtitle: '', icon: <Shield className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />, onClick: () => { setLegalModalType('privacy'); setIsLegalModalOpen(true); } },
                        { title: t.support, subtitle: 'SMARTEYE Help', icon: <User className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />, onClick: () => setIsSupportModalOpen(true) },
                      ].map((item, idx)=>{
                        const isLink = 'link' in item && item.link;
                        const Body = (
                          <>
                             <div className="p-2.5 sm:p-3 bg-black/40 rounded-xl text-gray-500 group-hover:border-white/20 group-hover:text-white transition-colors w-fit mb-3 sm:mb-4 border border-white/5 shadow-inner">
                              {item.icon}
                            </div>
                            <div>
                              <div className="text-xs sm:text-sm font-black text-white mb-1 group-hover:text-white transition-colors whitespace-pre-line">{item.title}</div>
                              <div className="text-[9px] sm:text-[10px] text-gray-500 font-bold">{item.subtitle}</div>
                            </div>
                          </>
                        );

                        if (isLink) {
                          return (
                            <a key={idx} href={(item as any).link} target="_blank" rel="noopener noreferrer" className="flex flex-col p-4 sm:p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all group aspect-video sm:aspect-auto sm:min-h-[140px] lg:aspect-square">
                              {Body}
                            </a>
                          );
                        }

                        return (
                          <button key={idx} onClick={(item as any).onClick} className="flex flex-col p-4 sm:p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all group text-left aspect-video sm:aspect-auto sm:min-h-[140px] lg:aspect-square">
                            {Body}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Products & Services Section - FULL WIDTH AT BOTTOM */}
              <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-8 backdrop-blur-2xl transition-all relative overflow-hidden group shadow-[0_0_40px_rgba(255,255,255,0.03)] focus-within:ring-2 focus-within:ring-white/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] -mr-32 -mt-32 group-hover:bg-white/10 transition-all duration-1000" />
                
                <h3 className="text-[14px] font-black text-gray-500 uppercase tracking-[0.25em] mb-8 flex items-center gap-4">
                  <Zap size={20} className="text-gray-600" /> {t.products_services}
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {[
                    { title: t.screener_service, icon: LayoutGrid },
                    { title: t.coin_screener_service, icon: Search },
                    { title: t.multi_charts_service, icon: LayoutGrid },
                    { title: t.price_notifications_service, icon: Bell },
                    { title: t.demo_trading_service, icon: PlayCircle },
                    { title: t.ai_analytics_service, icon: BrainCircuit },
                    { title: t.trading_simulator_service, icon: TrendingUp },
                    { title: t.affiliate_program_service, icon: Users },
                  ].map((item, idx) => (
                    <div 
                        key={idx} 
                        className="flex flex-col items-center justify-center p-5 rounded-[1.5rem] bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 active:bg-white/[0.08] transition-all group/svc text-center min-h-[120px] overflow-hidden"
                      >
                      <div className="p-3 bg-black/40 rounded-2xl text-gray-500 group-hover/svc:text-white group-hover/svc:scale-110 group-hover/svc:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all mb-4 border border-white/5 flex items-center justify-center">
                        <item.icon className="w-6 h-6" strokeWidth={2} />
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-black text-gray-300 group-hover/svc:text-white transition-colors leading-tight px-1">
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

            {activeTab === 'affiliate' && (
              <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-8 backdrop-blur-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.03)] animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
                <div 
                  onClick={() => document.getElementById('withdraw-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="absolute top-8 right-8 flex items-center gap-3 p-3 bg-[#0c0c0e]/95 border border-white/20 rounded-2xl backdrop-blur-2xl cursor-pointer hover:bg-white/[0.08] transition-all group z-10 shadow-[0_0_40px_rgba(255,255,255,0.03)]"
                >
                  <div className="w-10 h-10 bg-white/[0.05] rounded-xl flex items-center justify-center border border-white/10 group-hover:border-purple-500/30 transition-colors">
                    <Wallet size={20} className="text-gray-400 group-hover:text-purple-400 transition-colors" />
                  </div>
                  <div className="text-right pr-1">
                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-0.5">{language === 'ru' ? 'Кошелек' : 'Wallet'}</div>
                    <div className="text-sm font-black text-white">${earningsSummary.available_balance.toFixed(2)}</div>
                  </div>
                </div>

                <div className="max-w-5xl mx-auto">
                  <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8 mb-12">
                    <div className="flex w-24 h-24 bg-[#0c0c0e]/95 rounded-3xl items-center justify-center border border-white/20 shrink-0 shadow-[0_0_40px_rgba(255,255,255,0.03)]">
                      <Users size={48} className="text-white" />
                    </div>
                    <div className="flex-1 text-left pt-2">
                      <div className="flex flex-wrap justify-start gap-3 md:gap-4 mb-6">
                        <div className="px-4 md:px-6 py-2.5 md:py-3 bg-[#0c0c0e]/95 border border-white/20 rounded-2xl text-[10px] md:text-[11px] font-black text-white uppercase tracking-[0.15em] backdrop-blur-2xl shadow-xl hover:bg-white/[0.15] transition-all">
                          {language === 'ru' ? 'Ваш доход: 20%' : 'Your Income: 20%'}
                        </div>
                        <div className="px-4 md:px-6 py-2.5 md:py-3 bg-[#0c0c0e]/95 border border-white/20 rounded-2xl text-[10px] md:text-[11px] font-black text-white uppercase tracking-[0.15em] backdrop-blur-2xl shadow-xl hover:bg-white/[0.15] transition-all">
                          {language === 'ru' ? 'Скидка рефералу: 10%' : 'Referral Discount: 10%'}
                        </div>
                      </div>
                      <p className="text-white/90 text-sm md:text-base leading-relaxed max-w-2xl">{t.affiliate_desc}</p>
                    </div>
                  </div>
                  
                  {partnerError && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                      <AlertCircle size={20} />
                      {partnerError}
                    </div>
                  )}

                  <div className="relative group mb-12">
                    <div className="relative flex items-center gap-4 p-4 bg-[#0c0c0e]/95 border border-white/20 rounded-2xl backdrop-blur-2xl">
                      <div className="flex-1 text-left font-mono text-sm text-white truncate px-2">
                        {referralLink}
                      </div>
                      <button 
                        onClick={handleCopy}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? t.copied_label : t.copy_link}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
                    {[
                      { id: 'referrals', icon: <Users size={40} className="text-white" />, count: referrals.length, label: language === 'ru' ? 'Всего партнеров' : 'Total Partners', iconSmall: <Users size={12} className="text-white" /> },
                      { id: 'clicks', icon: <MousePointerClick size={40} className="text-white" />, count: 175, label: language === 'ru' ? 'Клики по ссылке' : 'Link Clicks', iconSmall: <MousePointerClick size={12} className="text-white" /> },
                      { id: 'paid', icon: <CheckCircle size={40} className="text-green-400" />, count: referrals.filter(r => r.status === 'paid').length, label: language === 'ru' ? 'Выплачено' : 'Paid', iconSmall: <CheckCircle size={12} className="text-green-400" /> },
                      { id: 'unpaid', icon: <Clock size={40} className="text-gray-400" />, count: lastWithdrawDate + ' / ' + todayDate, label: language === 'ru' ? 'Период выплат' : 'Payout Period', iconSmall: <Clock size={12} className="text-gray-400" />, isDates: true },
                      { id: 'income', icon: <TrendingUp size={40} className="text-green-400" />, count: '$' + earningsSummary.total_earnings.toFixed(2), label: language === 'ru' ? 'Общий доход с рефералов' : 'Total Referral Income', iconSmall: <TrendingUp size={12} className="text-green-400" /> },
                    ].map((btn) => (
                      <button 
                        key={btn.id}
                        onClick={() => setActiveStatsTab(btn.id as any)}
                        className={`p-6 rounded-[2rem] border backdrop-blur-2xl relative overflow-hidden group transition-all text-left aspect-square lg:aspect-[4/5] shadow-[0_0_40px_rgba(255,255,255,0.03)] ${activeStatsTab === btn.id ? 'bg-white/[0.08] border-white/40 ring-1 ring-white/10' : 'bg-[#0c0c0e]/95 border-white/20 hover:bg-[#121215]/95'}`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-30 group-hover:opacity-50 transition-opacity">
                          {btn.icon}
                        </div>
                        <div className={btn.isDates ? "text-sm font-bold text-white mb-1" : "text-2xl font-bold text-white mb-1"}>{btn.count}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-2">
                          {btn.iconSmall}
                          {btn.label}
                        </div>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {activeStatsTab && (
                      <motion.div 
                        key={activeStatsTab}
                        id="stats-details"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mt-6 p-8 bg-[#0c0c0e]/95 rounded-[2rem] border border-white/20 backdrop-blur-2xl shadow-[0_0_40px_rgba(255,255,255,0.03)]"
                      >
                        {activeStatsTab === 'premium_history' ? (
                          <div className="space-y-6">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                              <Star size={20} className="text-yellow-400" />
                              История премиум покупок
                            </h4>
                            <div className="space-y-3">
                              {premiumHistory.length > 0 ? premiumHistory.map((purchase, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                      <Star size={18} className="text-yellow-400" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-white">{purchase.plan_tier.toUpperCase()}</div>
                                      <div className="text-[10px] text-gray-500">
                                        {new Date(purchase.purchase_date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-white">${purchase.amount}</div>
                                    <div className="text-[10px] text-gray-500">
                                      До {new Date(purchase.expiry_date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <div className="text-center py-8 text-gray-500">
                                  История покупок пуста
                                </div>
                              )}
                            </div>
                          </div>
                        ) : activeStatsTab === 'referrals' ? (
                          <div className="space-y-6">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                              <Users size={20} className="text-purple-400" />
                              Список рефералов
                            </h4>
                            <div className="space-y-3">
                              {referrals.length > 0 ? referrals.map((ref, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                      <User size={18} className="text-purple-400" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-white">{ref.referred_username || ref.referred_email}</div>
                                      <div className="text-[10px] text-gray-500">
                                        Присоединился: {new Date(ref.joined_at || ref.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-sm font-bold ${ref.status === 'paid' ? 'text-green-400' : 'text-gray-500'}`}>
                                      {ref.status === 'paid' ? `+$${parseFloat(ref.commission_amount as any).toFixed(2)}` : 'Ожидание'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">
                                      {ref.status === 'paid' ? 'Оплачено' : 'Не оплачено'}
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <div className="text-center py-8 text-gray-500">
                                  У вас пока нет рефералов
                                </div>
                              )}
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/5">
                              <h5 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Тарифы комиссий</h5>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {commissionRates.map((rate, idx) => (
                                  <div key={idx} className="p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                    <div className="text-xs font-bold text-white mb-1">{rate.tier}</div>
                                    <div className="text-[10px] text-green-400 font-black">+$ {rate.commission.toFixed(2)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : activeStatsTab === 'paid' ? (
                          <div className="space-y-6">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                              <Clock size={20} className="text-green-400" />
                              История выплат
                            </h4>
                            <div className="space-y-3">
                              {paymentHistory.map((payment, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                      <Check size={18} className="text-green-400" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold text-white">{payment.amount}</div>
                                      <div className="text-[10px] text-gray-500">{payment.date}</div>
                                    </div>
                                  </div>
                                  <div className="px-3 py-1 bg-green-500/10 rounded-full text-[10px] font-bold text-green-400 uppercase tracking-wider">
                                    Выполнено
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : activeStatsTab === 'unpaid' ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock size={20} className="text-gray-400" />
                                Период накопления
                              </h4>
                              <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5">
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">
                                  С момента последней выплаты
                                </div>
                                <div className="text-xl font-bold text-white flex items-center gap-3">
                                  <span>{lastWithdrawDate}</span>
                                  <ChevronRight size={16} className="text-gray-600" />
                                  <span className="text-gray-400">{todayDate}</span>
                                </div>
                                <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                                  В этом блоке отображается комиссия, накопленная вами за период после последнего успешного вывода средств.
                                </p>
                              </div>
                              <div className="p-4 bg-white/[0.05] rounded-xl border border-white/10 backdrop-blur-md">
                                <div className="text-sm font-bold text-white mb-1">
                                  Текущий баланс
                                </div>
                                <div className="text-2xl font-black text-gray-400">${referrals.filter(r => r.status === 'unpaid').reduce((acc, r) => acc + parseFloat(r.commission_amount as any), 0).toFixed(2)}</div>
                              </div>
                            </div>
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                  <TrendingUp size={20} className="text-gray-400" />
                                  Динамика дохода
                                </h4>
                                <div className="flex bg-white/[0.05] p-1 rounded-lg border border-white/10 backdrop-blur-md">
                                  {(['1m', '6m', '1y'] as const).map((tf) => (
                                    <button
                                      key={tf}
                                      onClick={() => setChartTimeframe(tf)}
                                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartTimeframe === tf ? 'bg-white/20 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                      {tf === '1m' ? '1М' : tf === '6m' ? '6М' : '1Г'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dynamicChartData}>
                                    <defs>
                                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={true} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={true} axisLine={true} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} itemStyle={{ color: '#fff' }} />
                                    <Area type="monotone" dataKey="income" stroke="#7c3aed" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} dot={{ r: 4, fill: '#0c0c0e', stroke: '#4b5563', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                <Info size={20} className={activeStatsTab === 'clicks' ? 'text-white' : 'text-green-400'} />
                                {activeStatsTab === 'clicks' ? (language === 'ru' ? 'Статистика кликов' : 'Click Stats') : (language === 'ru' ? 'Кошелек' : 'Wallet')}
                              </h4>
                              
                              {activeStatsTab === 'clicks' ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                                        Всего кликов
                                      </div>
                                      <div className="text-2xl font-black text-white">175</div>
                                    </div>
                                    <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5">
                                      <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                                        Уникальные
                                        <div className="group relative">
                                          <Info size={10} className="text-gray-600 cursor-help" />
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black border border-white/10 rounded-lg text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 backdrop-blur-xl">
                                            {language === 'ru' 
                                              ? 'Клики от пользователей, которые перешли по ссылке впервые' 
                                              : 'Clicks from users who followed the link for the first time'}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-2xl font-black text-white">142</div>
                                    </div>
                                  </div>
                                  <div className="p-6 bg-white/[0.05] rounded-2xl border border-white/10 backdrop-blur-md">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                      Здесь отображается общее количество переходов по вашей реферальной ссылке. Уникальные клики учитывают только новых посетителей.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="p-6 bg-green-500/5 rounded-2xl border border-green-500/10">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                                      Всего заработано
                                    </div>
                                    <div className="text-3xl font-black text-green-400">${earningsSummary.total_earnings.toFixed(2)}</div>
                                  </div>
                                  <p className="text-xs text-green-300 leading-relaxed">
                                    Это общая сумма всех ваших комиссионных отчислений за все время работы в партнерской программе.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                  <TrendingUp size={20} className={activeStatsTab === 'clicks' ? 'text-white' : 'text-green-400'} />
                                  {activeStatsTab === 'clicks' ? 'Динамика кликов' : 'Динамика дохода'}
                                </h4>
                                <div className="flex bg-white/[0.05] p-1 rounded-lg border border-white/10 backdrop-blur-md">
                                  {(['1m', '6m', '1y'] as const).map((tf) => (
                                    <button
                                      key={tf}
                                      onClick={() => setChartTimeframe(tf)}
                                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartTimeframe === tf ? 'bg-white/20 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                      {tf === '1m' ? '1М' : tf === '6m' ? '6М' : '1Г'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dynamicChartData}>
                                    <defs>
                                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={true} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={true} axisLine={true} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} itemStyle={{ color: '#fff' }} />
                                    <Area type="monotone" dataKey={activeStatsTab === 'clicks' ? 'clicks' : 'income'} stroke="#7c3aed" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} dot={{ r: 4, fill: '#0c0c0e', stroke: '#4b5563', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }} />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div id="withdraw-section" className="mt-12 p-8 bg-[#0c0c0e]/95 rounded-[2rem] border border-white/20 text-left scroll-mt-8 hover:border-white/30 transition-all duration-500 backdrop-blur-2xl shadow-[0_0_40px_rgba(255,255,255,0.03)] focus-within:ring-2 focus-within:ring-white/20">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <Wallet size={20} className="text-gray-400" />
                      {language === 'ru' ? 'Вывод средств' : 'Withdraw Funds'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                          {language === 'ru' ? 'Адрес TRC20' : 'TRC20 Address'}
                        </label>
                        <input
                          type="text"
                          value={withdrawAddress}
                          onChange={(e) => setWithdrawAddress(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                          placeholder="T..."
                          className="w-full bg-white/[0.03] border border-gray-500/30 rounded-xl px-4 py-4 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-end ml-1">
                          <label className="text-[12px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            {language === 'ru' ? 'Сумма вывода' : 'Withdrawal Amount'}
                          </label>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setWithdrawAmount(earningsSummary.available_balance.toFixed(2))}
                              className="text-[10px] text-white font-black uppercase tracking-widest hover:text-gray-300 transition-colors"
                            >
                              {language === 'ru' ? 'МАКС' : 'MAX'}
                            </button>
                            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                              {language === 'ru' ? 'Мин. 25$' : 'Min. $25'}
                            </span>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="25"
                            min="25"
                            className={`w-full bg-white/[0.03] border rounded-xl px-4 py-4 text-sm text-white focus:outline-none transition-colors font-mono pr-12 ${(parseFloat(withdrawAmount) > earningsSummary.available_balance || (withdrawAmount !== '' && earningsSummary.available_balance < 25)) ? 'border-red-500/50 focus:border-red-500' : 'border-gray-500/30 focus:border-gray-400'}`}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">$</div>
                        </div>
                        {(parseFloat(withdrawAmount) > earningsSummary.available_balance || (withdrawAmount !== '' && earningsSummary.available_balance < 25)) && (
                          <p className="text-[10px] text-red-400 font-bold mt-1 ml-1 animate-pulse">
                            {language === 'ru' ? 'Недостаточно средств' : 'Insufficient funds'}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !withdrawAddress.trim() || !withdrawAmount.trim()}
                        className="w-full py-4 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:bg-gray-100 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {isWithdrawing ? t.analyzing : (language === 'ru' ? 'Создать заявку на вывод' : 'Create Withdrawal Request')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'guide' && (
              <div className="bg-[#0c0c0e]/95 border border-white/20 rounded-[2rem] p-8 backdrop-blur-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.03)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <BookOpen size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{t.guide_title}</h2>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">{t.guide_subtitle}</p>
                  </div>
                </div>

                <div className="space-y-4 max-w-6xl">
                  {[
                    {
                      id: 1,
                      question: t.guide_q1,
                      answer: (
                        <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
                          <p>• {t.guide_a1_1}</p>
                          <p>• <span className="text-red-400/80">Stop-Loss</span> {t.guide_a1_2}</p>
                          <p>• {t.guide_a1_3}</p>
                          <p>• {t.guide_a1_4}</p>
                          <p>• {t.guide_a1_5}</p>
                        </div>
                      )
                    },
                    {
                      id: 2,
                      question: t.guide_q2,
                      answer: (
                        <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
                          <p>• {t.guide_a2_1}</p>
                          <p>• {t.guide_a2_2}</p>
                          <p>• {t.guide_a2_3}</p>
                        </div>
                      )
                    },
                    {
                      id: 3,
                      question: t.guide_q3,
                      answer: (
                        <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
                          <p>• {t.guide_a3_1}</p>
                          <p>• {t.guide_a3_2}</p>
                        </div>
                      )
                    },
                    {
                      id: 4,
                      question: t.guide_q4,
                      answer: (
                        <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
                          <p>• {t.guide_a4_1}</p>
                          <p>• {t.guide_a4_2}</p>
                        </div>
                      )
                    },
                    {
                      id: 5,
                      question: t.guide_q5,
                      answer: (
                        <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
                          <p>• <span className="text-white/90">{language === 'ru' ? 'Отсутствие знаний:' : 'Lack of knowledge:'}</span> {t.guide_a5_1}</p>
                          <p>• <span className="text-white/90">{language === 'ru' ? 'Нарушение риск-менеджмента:' : 'Risk management violation:'}</span> {t.guide_a5_2}</p>
                        </div>
                      )
                    }
                  ].map((item) => (
                    <div key={item.id} className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.05] transition-all">
                      <button 
                        onClick={() => setOpenAccordion(openAccordion === item.id ? null : item.id)}
                        className="w-full flex items-center justify-between p-5 text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-xs text-gray-400 group-hover:text-white group-hover:bg-purple-500/20 transition-all">
                            {item.id}
                          </span>
                          <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                            {item.question}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: openAccordion === item.id ? 180 : 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="text-gray-500 group-hover:text-white"
                        >
                          <ArrowLeft size={16} className="-rotate-90" />
                        </motion.div>
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {openAccordion === item.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                          >
                            <div className="px-5 pb-5 pt-0 pl-[68px]">
                              <div className="h-px bg-white/5 mb-4 w-full" />
                              {item.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 pt-8 border-t border-white/5">
                    <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 backdrop-blur-md">
                      <h4 className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
                        <Shield size={16} className="text-purple-400" /> {t.why_orderbook}
                      </h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{t.why_orderbook_desc}</p>
                    </div>
                    <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 backdrop-blur-md">
                      <h4 className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
                        <ExternalLink size={16} className="text-blue-400" /> {t.which_to_choose}
                      </h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{t.which_to_choose_desc}</p>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl border border-white/10 mt-8 backdrop-blur-md">
                    <h4 className="font-bold text-white mb-3">{t.useful_tips}</h4>
                    <ul className="space-y-3 text-sm text-gray-400">
                      <li className="flex gap-3"><span className="text-purple-400 font-bold">•</span> {t.tip_1}</li>
                      <li className="flex gap-3"><span className="text-purple-400 font-bold">•</span> {t.tip_2}</li>
                      <li className="flex gap-3"><span className="text-purple-400 font-bold">•</span> {t.tip_3}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tiger Trade Section - Now at the absolute bottom of profile content area */}
            {activeTab !== 'affiliate' && activeTab !== 'guide' && (
              <div className="w-full mt-12 sm:mt-24 border-t border-white/5 pt-12 sm:pt-24 opacity-90 hover:opacity-100 transition-opacity">
                <PartnersSection 
                  language={language} 
                  subscriptionTier={subscriptionTier}
                  setSubscriptionTier={setSubscriptionTier}
                  setAvatarTier={setAvatarTier}
                  setPremiumEndDate={setPremiumEndDate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isVipModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsVipModalOpen(false)} />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[#0c0c0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.15)]"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsVipModalOpen(false)}
                className="absolute top-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-50 group"
              >
                <ArrowLeft size={20} className="text-gray-400 group-hover:text-white transition-colors" />
              </button>

              <div className="p-8 sm:p-12 flex flex-col items-center text-center">
                <h2 className="text-2xl sm:text-4xl font-black text-white mb-12 tracking-tighter uppercase">
                  SmartEye <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-rose-500 bg-clip-text text-transparent">{t.subscription_status}</span>
                </h2>

                {/* Carousel-like display */}
                <div className="relative w-full h-[300px] sm:h-[400px] flex items-center justify-center mb-12">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {avatarTiers.map((tier, idx) => {
                      const isSelected = avatarTier === tier;
                      const tierIndex = avatarTiers.indexOf(avatarTier);
                      const diff = idx - tierIndex;
                      
                      // Simple positioning logic for 4 items
                      let x = diff * 150;
                      let scale = 1 - Math.abs(diff) * 0.3;
                      let opacity = 1 - Math.abs(diff) * 0.6;
                      let zIndex = 10 - Math.abs(diff);

                      if (Math.abs(diff) > 1.5) opacity = 0;

                      return (
                        <motion.div
                          key={tier}
                          animate={{ 
                            x: x,
                            scale: scale,
                            opacity: opacity,
                            zIndex: zIndex
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="absolute cursor-pointer"
                          onClick={() => {
                            if (!isTierLocked(tier)) {
                              setAvatarTier(tier);
                            }
                          }}
                        >
                          <div className={`relative ${isSelected ? 'scale-110' : ''} transition-transform duration-500`}>
                            <div className={isTierLocked(tier) ? 'grayscale opacity-50' : ''}>
                              <SubscriptionAvatar tier={tier} size={isSelected ? 280 : 180} padding="p-2" />
                            </div>
                            {isSelected && (
                              <div className="absolute -inset-4 bg-purple-500/20 blur-3xl rounded-full -z-10 animate-pulse" />
                            )}
                            {isTierLocked(tier) && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10">
                                  <Shield size={24} className="text-gray-400" />
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Arc and Numbers */}
                <div className="relative w-full max-w-2xl px-12 pb-12">
                  {/* The Arc Line */}
                  <div className="absolute top-1/2 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  
                  <div className="flex justify-between relative z-10">
                    {avatarTiers.map((tier, idx) => (
                      <button
                        key={tier}
                        onClick={() => {
                          if (!isTierLocked(tier)) {
                            setAvatarTier(tier);
                          }
                        }}
                        className={`flex flex-col items-center gap-4 group ${isTierLocked(tier) ? 'cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center text-sm sm:text-xl font-black transition-all duration-500 ${
                          avatarTier === tier 
                          ? 'bg-white text-black border-white scale-125 shadow-[0_0_30px_rgba(255,255,255,0.3)]' 
                          : isTierLocked(tier)
                            ? 'bg-black border-white/5 text-gray-700'
                            : 'bg-black border-white/10 text-gray-500 hover:border-white/30 hover:text-white'
                        }`}>
                          {isTierLocked(tier) ? <Shield size={16} /> : idx}
                        </div>
                        <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 ${
                          avatarTier === tier ? 'text-white' : 'text-gray-600'
                        }`}>
                          {tier === 'free' ? t.plan_free : tier === '1month' ? t.plan_1month : tier === '3months' ? t.plan_3months : t.plan_1year}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tier Info */}
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPaymentSuccessOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setIsPaymentSuccessOpen(false)} />
            
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="relative w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(34,197,94,0.15)] p-8 text-center"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600" />
              
              <div className="mb-8 relative">
                <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 relative z-10">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 opacity-50" />
              </div>

              <h2 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">
                {t.payment_success}
              </h2>
              
              <p className="text-gray-400 text-sm font-bold leading-relaxed mb-8">
                {t.payment_success_desc}
              </p>

              <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 mb-8 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.plan_label}</span>
                  <span className="text-xs font-black text-white uppercase tracking-wider">{plans[selectedPlan].name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.expires_label}</span>
                  <span className="text-xs font-black text-white tracking-tight">{plans[selectedPlan].endDate}</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsPaymentSuccessOpen(false);
                  setActiveTab('profile');
                }}
                className="w-full py-4 rounded-xl bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {t.go_to_profile}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="h-64 pointer-events-none" />
      <Footer 
        language={language} 
        onOpenLegal={(type) => {
          setLegalModalType(type);
          setIsLegalModalOpen(true);
        }}
        onNavigate={(target) => {
          if (target === 'affiliate') {
            setActiveTab('affiliate');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (target === 'screener') {
            onBack('screener');
          } else if (target === 'market' || target === 'simulator') {
            onBack('market');
          }
        }}
      />

      <LegalModal 
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        language={language}
        type={legalModalType}
      />

      {/* Support Chat Modal */}
      <AnimatePresence>
        {isSupportModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg h-[600px] flex flex-col bg-[#080810] border border-white/10 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.9)] overflow-hidden"
            >
              {/* Header */}
              <div className="relative z-10 p-6 border-b border-white/5 bg-white/2 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-blue-600/30 flex items-center justify-center border border-white/10">
                    <Headset size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider">{t.support_title}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSupportModalOpen(false)}
                  className="p-2.5 hover:bg-white/5 rounded-full transition-all group active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors rotate-180" />
                </button>
              </div>

              {/* Chat Canvas (Messages Area) */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-[#050508]"
                style={{ scrollBehavior: 'smooth' }}
              >
                {supportMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-10">
                    <div className="p-4 border border-dashed border-white/20 rounded-full mb-4">
                      <MessageCircle size={32} />
                    </div>
                    <p className="text-sm font-mono uppercase tracking-widest">{t.support_placeholder}</p>
                  </div>
                ) : (
                  supportMessages.map((msg, idx) => {
                    const isUser = msg.sender_type === 'user';
                    return (
                      <div 
                        key={msg.id || idx}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'} group items-end gap-3`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                            <Headset size={14} />
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 max-w-[80%]">
                          <div className={`relative px-4 py-3 rounded-2xl transition-all ${
                            isUser 
                            ? 'bg-white/5 border border-white/10 rounded-br-sm group-hover:bg-white/10' 
                            : 'bg-purple-900/10 border border-purple-500/20 rounded-bl-sm text-purple-50/90'
                          }`}>
                            <p className="text-sm leading-relaxed tracking-wide">{msg.message}</p>
                            
                            {isUser && (
                              <div className="absolute -left-6 bottom-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <CheckCircle2 size={12} className="text-green-500" />
                              </div>
                            )}
                          </div>
                          <span className={`text-[9px] font-mono opacity-30 uppercase tracking-tighter ${isUser ? 'text-right' : 'text-left'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Control Area */}
              <div className="p-6 bg-white/2 border-t border-white/5">
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-12 bg-black/40 border border-white/10 rounded-2xl flex items-center px-4 group focus-within:border-purple-500/50 transition-all">
                    <input
                      type="text"
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      onKeyDown={(e) => {
                         if (e.key === 'Enter') handleSendSupport();
                      }}
                      placeholder={t.support_type_message || "Напишите сообщение..."}
                      className="w-full bg-transparent border-none outline-none text-white text-sm placeholder-gray-600 font-medium"
                    />
                  </div>
                  <button
                    disabled={!supportMessage.trim() || isSendingSupport}
                    onClick={handleSendSupport}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                    <Send size={18} className={isSendingSupport ? 'animate-pulse' : ''} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};
const PartnersSection: React.FC<{ 
  language: Language;
  subscriptionTier: 'free' | 'pro' | 'whale';
  setSubscriptionTier: (tier: 'free' | 'pro' | 'whale') => void;
  setAvatarTier: (tier: 'free' | '1month' | '3months' | '1year') => void;
  setPremiumEndDate: (date: string) => void;
}> = ({ 
  language, 
  subscriptionTier, 
  setSubscriptionTier, 
  setAvatarTier, 
  setPremiumEndDate 
}) => {
  const t = translations['ru']; // Force Russian for this block as requested
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Partner Dashboard states (hidden by default)
  const [showDashboard, setShowDashboard] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(partnerService.isAuthenticated());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [referralInput, setReferralInput] = useState('');
  const [referralType, setReferralType] = useState<'apiKeys' | 'emails' | 'emailHashes' | 'userIds'>('emails');
  const [referralResults, setReferralResults] = useState<ReferralData[]>([]);
  const [checkingReferrals, setCheckingReferrals] = useState(false);

  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [earnings, setEarnings] = useState<EarningReport[]>([]);
  const [fetchingEarnings, setFetchingEarnings] = useState(false);
  const [accumulatedCommission, setAccumulatedCommission] = useState(0);
  const TARGET_COMMISSION = 19;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // If partner is logged in, we can do a real check
      if (partnerService.isAuthenticated()) {
        const results = await partnerService.checkReferralsByEmails([email.trim()]);
        const result = results[0];
        
        if (result && result.isReferral) {
          setStatus('success');
          localStorage.setItem('tiger_trade_connected_email', email.trim());
          // After connection, check for earnings to grant free sub
          await checkSubscriptionStatus(email.trim());
        } else {
          setStatus('error');
          setErrorMessage(t.connection_error || (language === 'ru' ? 'Аккаунт не найден в списке рефералов' : 'Account not found in referral list'));
        }
      } else {
        // For end-users, we save the email and show "Connected (Pending Verification)"
        // This allows them to proceed, and the owner can verify later or via a master token
        localStorage.setItem('tiger_trade_connected_email', email.trim());
        setStatus('success');
        // We'll show a slightly different message if not verified yet
        setErrorMessage(language === 'ru' ? 'Аккаунт сохранен. Ожидание подтверждения администратором.' : 'Account saved. Waiting for administrator verification.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async (connectedEmail: string) => {
    // Manual grant if target reached
    if (accumulatedCommission >= TARGET_COMMISSION) {
      setSubscriptionTier('pro');
      setAvatarTier('1month');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setPremiumEndDate(nextMonth.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }));
      
      setAccumulatedCommission(0); // Commission burns after update
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      return;
    }

    if (!partnerService.isAuthenticated()) return;
    
    try {
      // Check earnings for the last 30 days
      const dateTo = new Date().toISOString().split('T')[0];
      const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const earningsData = await partnerService.getEarnings(dateFrom, dateTo);
      // Find earnings for this specific email (masked email check)
      const userEarnings = earningsData.filter(e => {
        // Simple check: if the email matches or if it's a masked version
        // In a real app, we'd use emailHash for perfect matching
        return e.email.toLowerCase().includes(connectedEmail.split('@')[0].toLowerCase());
      });

      const totalEarnings = userEarnings.reduce((acc, curr) => acc + curr.partnerEarnings, 0);
      setAccumulatedCommission(totalEarnings);

      if (totalEarnings >= TARGET_COMMISSION) {
        // Grant free subscription
        setSubscriptionTier('pro');
        setAvatarTier('1month');
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setPremiumEndDate(nextMonth.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }));
        
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Failed to check subscription status:', err);
    }
  };

  useEffect(() => {
    const connectedEmail = localStorage.getItem('tiger_trade_connected_email');
    if (connectedEmail && partnerService.isAuthenticated()) {
      checkSubscriptionStatus(connectedEmail);
    }
  }, []);

  const handlePartnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      await partnerService.login(username, password);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    partnerService.logout();
    setIsAuthenticated(false);
    setShowDashboard(false);
  };

  const handleCheckReferrals = async () => {
    if (!referralInput.trim()) return;
    setCheckingReferrals(true);
    try {
      const items = referralInput.split(',').map(s => s.trim()).filter(Boolean);
      let results: ReferralData[] = [];
      if (referralType === 'apiKeys') {
        results = await partnerService.checkReferralsByApiKeys(items);
      } else if (referralType === 'emails') {
        results = await partnerService.checkReferralsByEmails(items);
      } else if (referralType === 'emailHashes') {
        results = await partnerService.checkReferralsByEmailHashes(items);
      } else {
        results = await partnerService.checkReferralsByUserIds(items);
      }
      setReferralResults(results);
    } catch (err: any) {
      console.error(err);
    } finally {
      setCheckingReferrals(false);
    }
  };

  const handleFetchEarnings = async () => {
    setFetchingEarnings(true);
    try {
      const data = await partnerService.getEarnings(dateFrom, dateTo);
      setEarnings(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFetchingEarnings(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden bg-gradient-to-br from-white/90 via-rose-100/80 to-orange-100/80 rounded-3xl p-5 md:p-8 shadow-2xl group border-2 border-purple-500/30 hover:border-purple-500/50 transition-all duration-500">
        {/* Content matching the image structure */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#ff3366] rounded-lg flex items-center justify-center overflow-hidden border border-white/20 shadow-[0_0_10px_rgba(255,51,102,0.3)]">
                <img 
                  src="https://tiger.trade/favicon.ico" 
                  className="w-5 h-5 object-contain brightness-0 invert" 
                  alt="Tiger Trade" 
                  referrerPolicy="no-referrer"
                  loading="eager"
                />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">{t.tiger_trade_title}</h2>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">
                {t.tiger_trade_promo}
              </h3>
              <a 
                href="https://tiger.trade" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 underline underline-offset-4 transition-colors"
              >
                {t.how_it_works} <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-gray-600 font-medium">
              {t.connect_link_text}{' '}
              <a href="#" className="text-gray-900 font-bold underline underline-offset-4 hover:text-black transition-colors">
                {t.using_our_link}
              </a>
            </p>

            <form onSubmit={handleConnect} className="relative max-w-xl">
              <div className="relative flex items-center p-0.5 bg-black/5 backdrop-blur-md rounded-xl border border-black/10 focus-within:border-black/20 transition-all">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.account_email_placeholder}
                  className="flex-1 bg-transparent border-none rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-black text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                >
                  {loading ? t.analyzing : t.connect_button}
                </button>
              </div>

              <AnimatePresence>
                {status === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -bottom-12 left-0 right-0 text-center space-y-1"
                  >
                    <div className="text-xs font-black text-green-600 uppercase tracking-widest">
                      <CheckCircle size={14} className="inline mr-2" /> {t.connection_success}
                    </div>
                    {errorMessage && (
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {errorMessage}
                      </div>
                    )}
                  </motion.div>
                )}

                {status === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -bottom-12 left-0 right-0 text-center text-xs font-black text-red-600 uppercase tracking-widest"
                  >
                    {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Subscription Status Info */}
          {localStorage.getItem('tiger_trade_connected_email') && localStorage.getItem('tiger_trade_connected_email') !== '' && (
            <div className="pt-4 border-t border-black/10 space-y-4">
              <div className="flex items-center justify-between bg-black/5 rounded-xl p-3 border border-black/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center border border-orange-500/20">
                    <Star size={16} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{t.status_label}</div>
                    <div className="text-xs font-black text-gray-900 uppercase tracking-tight">
                      {subscriptionTier !== 'free' ? (language === 'ru' ? 'Премиум активен' : 'Premium Active') : t.waiting_volume}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => checkSubscriptionStatus(localStorage.getItem('tiger_trade_connected_email') || '')}
                    className="px-4 py-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-black shadow-[0_0_15px_rgba(234,179,8,0.3)] border border-yellow-300/30 active:scale-95"
                  >
                    {t.refresh_status}
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('tiger_trade_connected_email');
                      setStatus('idle');
                      setEmail('');
                    }}
                    className="p-2 bg-black/5 hover:bg-red-500/10 border border-black/5 hover:border-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-all active:scale-95"
                    title={language === 'ru' ? 'Отключить' : 'Disconnect'}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>

              {/* Commission Progress Bar */}
              <div className="bg-black/5 rounded-xl p-4 border border-black/10 space-y-3">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{t.trading_progress}</div>
                      <div className="px-1 py-0.5 rounded bg-black/10 border border-black/5 text-[7px] font-black text-gray-600 uppercase tracking-widest">
                        {t.period_label}: {t.plan_1month}
                      </div>
                    </div>
                    <div className="text-xl font-black text-gray-900">
                      ${accumulatedCommission.toFixed(2)} 
                      <span className="text-gray-400 text-xs ml-1.5">/ ${TARGET_COMMISSION}</span>
                    </div>
                  </div>
                  <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                    {Math.min(100, Math.round((accumulatedCommission / TARGET_COMMISSION) * 100))}%
                  </div>
                </div>

                <div className="relative h-2 bg-black/10 rounded-full overflow-hidden border border-black/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (accumulatedCommission / TARGET_COMMISSION) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-rose-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                  />
                </div>

                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  {accumulatedCommission >= TARGET_COMMISSION 
                    ? t.goal_reached 
                    : t.generate_more.replace('${amount}', (TARGET_COMMISSION - accumulatedCommission).toFixed(2))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />
      </div>

      {/* Hidden Partner Access (for admin/partner use) */}
      <div className="mt-20 flex justify-center opacity-10 hover:opacity-100 transition-all duration-500 pb-12">
        <button 
          onClick={() => {
            const pass = prompt('Partner Access Code:');
            if (pass === 'partner2024') { // Simple hidden gate
              setShowDashboard(true);
            }
          }}
          className="text-[8px] font-black text-gray-800 uppercase tracking-[0.5em] px-6 py-3 border border-dashed border-gray-800/30 rounded-full hover:border-purple-500/50 hover:text-purple-500/50 transition-all"
        >
          System Access
        </button>
      </div>

      {/* Partner Dashboard Modal */}
      <AnimatePresence>
        {showDashboard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl" 
              onClick={() => setShowDashboard(false)} 
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-6xl max-h-[90vh] bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto custom-scroll"
            >
              {!isAuthenticated ? (
                <div className="max-w-md mx-auto py-12">
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/20">
                      <Lock size={32} className="text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">{t.partner_login}</h2>
                  </div>

                  <form onSubmit={handlePartnerLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">{t.username}</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors font-bold"
                        placeholder="Partner ID"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">{t.password_label}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors font-bold"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    {loginError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400 font-bold text-center uppercase tracking-widest">
                        {loginError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {loading ? t.analyzing : t.login_button}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                        <Shield size={24} className="text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">{t.partner_dashboard}</h2>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Authenticated Session</span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-400 hover:text-red-400"
                    >
                      <LogOut size={14} /> {t.exit_btn}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Referral Checker */}
                    <div className="bg-black/40 border border-white/5 rounded-[2rem] p-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Search size={16} className="text-purple-400" /> {t.check_referrals}
                      </h3>
                      
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scroll">
                        {['apiKeys', 'emails', 'emailHashes', 'userIds'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setReferralType(type as any)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${referralType === type ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value)}
                        className="w-full h-32 bg-black/60 border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-purple-500/50 transition-colors font-mono mb-4 custom-scroll"
                        placeholder={`Enter ${referralType} separated by commas...`}
                      />
                      
                      <button
                        onClick={handleCheckReferrals}
                        disabled={checkingReferrals || !referralInput.trim()}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {checkingReferrals ? t.analyzing : t.check}
                      </button>

                      {referralResults.length > 0 && (
                        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scroll pr-2">
                          {referralResults.map((res, idx) => (
                            <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between text-[10px]">
                              <div className="truncate mr-4 text-gray-400 font-mono">{res.apiKey || res.email || res.emailHash || res.userId}</div>
                              <div className="flex gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded ${res.isReferral ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {res.isReferral ? 'REF' : 'NO'}
                                </span>
                                <span className={`px-2 py-0.5 rounded ${res.isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-500'}`}>
                                  {res.isActive ? 'ACT' : 'IN'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Earnings */}
                    <div className="bg-black/40 border border-white/5 rounded-[2rem] p-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-rose-400" /> {t.earnings_report}
                      </h3>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none focus:border-rose-500/50"
                        />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none focus:border-rose-500/50"
                        />
                      </div>

                      <button
                        onClick={handleFetchEarnings}
                        disabled={fetchingEarnings}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 mb-4"
                      >
                        {fetchingEarnings ? t.analyzing : t.fetch_report}
                      </button>

                      <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll pr-2">
                        {earnings.map((earn, idx) => (
                          <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 text-[9px]">
                            <div className="flex justify-between mb-1">
                              <span className="text-white font-bold">{earn.email}</span>
                              <span className="text-gray-500">{earn.tradingDay}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                              <span>Vol: ${earn.tradingVolume.toFixed(2)}</span>
                              <span className="text-rose-400 font-black">Earn: ${earn.partnerEarnings.toFixed(4)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
