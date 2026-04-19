
import React, { useState, useEffect, useRef } from 'react';
import { AuthMode } from '../../types';
import { Input, Button, PasswordStrength, Checkbox } from '../UI/Shared';
import { GoogleIcon, DiscordIcon, MetaMaskIcon, MailIcon, LockIcon, UserIcon, HumanIcon, CheckCircle } from '../UI/Icons';
import { LegalModal } from '../UI/LegalModal';

import { apiService } from '../../services/api.service';

export const AuthCard: React.FC<any> = ({ authMode, setAuthMode, onLoginSuccess, showToast, language }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', username: '', code: '' });
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLegal, setShowLegal] = useState<'terms' | 'privacy' | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { user, token } = event.data.payload;
        apiService.setToken(token);
        onLoginSuccess(user);
        showToast(`Вход выполнен: ${user.username}`, 'success');
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess, showToast]);

  const triggerGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { url } = await apiService.getGoogleAuthUrl();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        showToast('Всплывающее окно заблокировано. Пожалуйста, разрешите всплывающие окна.', 'error');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
      showToast('Ошибка при получении ссылки авторизации', 'error');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaVerified && (authMode === AuthMode.LOGIN || authMode === AuthMode.REGISTER)) {
        showToast('Подтвердите, что вы человек', 'error');
        return;
    }
    
    if (isRegister) {
      // Automatic acceptance as per user request
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        const result = await apiService.login({ email: formData.email, password: formData.password });
        onLoginSuccess(result.user);
        showToast('Доступ разрешен', 'success');
      } else if (isRegister) {
        const referrerId = localStorage.getItem('se_referrer_id');
        const result = await apiService.register({ 
          email: formData.email, 
          password: formData.password,
          username: formData.username,
          referrerId: referrerId || undefined
        });
        if (referrerId) localStorage.removeItem('se_referrer_id');
        onLoginSuccess(result.user);
        showToast('Аккаунт создан', 'success');
      } else if (authMode === AuthMode.RESET) {
        setAuthMode(AuthMode.VERIFY);
        showToast('Код отправлен (демо)', 'info');
      } else {
        setAuthMode(AuthMode.LOGIN);
      }
    } catch (error: any) {
      showToast(error.message || 'Ошибка авторизации', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin = authMode === AuthMode.LOGIN;
  const isRegister = authMode === AuthMode.REGISTER;

  return (
    <div className="w-full relative">
      {(isLogin || isRegister) && (
        <div className="flex p-1 mb-4 bg-white/5 rounded-xl border border-white/5 relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 border border-white/10 rounded-lg transition-all duration-300 ${isLogin ? 'left-1' : 'left-[calc(50%+4px)]'}`}></div>
          <button type="button" onClick={() => setAuthMode(AuthMode.LOGIN)} className={`flex-1 relative z-10 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${isLogin ? 'text-white' : 'text-gray-500'}`}>Вход</button>
          <button type="button" onClick={() => setAuthMode(AuthMode.REGISTER)} className={`flex-1 relative z-10 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${isRegister ? 'text-white' : 'text-gray-500'}`}>Регистрация</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {isRegister && <Input label="ИМЯ ПОЛЬЗОВАТЕЛЯ" placeholder="@trader_king" icon={<UserIcon className="w-5 h-5" />} value={formData.username} onChange={(e: any) => setFormData({...formData, username: e.target.value})} />}
        
        {(authMode !== AuthMode.VERIFY) && <Input label="ЭЛЕКТРОННАЯ ПОЧТА" type="email" placeholder="trade@smarteye.io" icon={<MailIcon className="w-5 h-5" />} value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />}
        
        {(isLogin || isRegister) && <div className="space-y-2">
            <Input label="ПАРОЛЬ" type="password" placeholder="••••••••" icon={<LockIcon className="w-5 h-5" />} value={formData.password} onChange={(e: any) => setFormData({...formData, password: e.target.value})} />
            {isRegister && <PasswordStrength password={formData.password} />}
        </div>}

        {authMode === AuthMode.VERIFY && <Input label="Код подтверждения" placeholder="000-000" className="text-center text-2xl tracking-[0.5em]" value={formData.code} onChange={(e: any) => setFormData({...formData, code: e.target.value})} />}

        {isLogin && <div className="flex justify-end"><button type="button" onClick={() => setAuthMode(AuthMode.RESET)} className="text-[10px] uppercase font-black text-gray-500 hover:text-white transition-colors tracking-widest">ЗАБЫЛИ ПАРОЛЬ?</button></div>}

        {(isLogin || isRegister) && (
          <Checkbox label={<div className="flex items-center gap-2"><HumanIcon className="w-4 h-4" /><span>Я человек</span></div>} checked={captchaVerified} onChange={setCaptchaVerified} />
        )}

        <Button type="submit" isLoading={isLoading} className="bg-[#1a1a24] hover:bg-[#252533] border border-white/10 text-white shadow-none py-3.5 text-[13px] uppercase tracking-[0.2em] font-black">{isLogin ? 'Войти в терминал' : isRegister ? 'Создать аккаунт' : 'Продолжить'}</Button>

        {(isLogin || isRegister) && (
          <div className="pt-2">
            <div className="relative flex items-center mb-2"><div className="flex-grow border-t border-white/5"></div><span className="mx-4 text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">или войти через</span><div className="flex-grow border-t border-white/5"></div></div>
            <div className="flex justify-center">
              <div className="relative group/google w-full">
                {/* Скрытый контейнер для реальной кнопки Google SDK */}
                <div ref={googleBtnRef} className="absolute inset-0 opacity-0 pointer-events-none z-0"></div>
                <Button type="button" variant="social" onClick={triggerGoogleLogin} disabled={isLoading} className="w-full py-2.5 flex justify-center items-center gap-3 bg-[#0d0d1a] border border-white/10 rounded-xl hover:bg-[#1a1a2e] transition-all">
                  <GoogleIcon className="w-5 h-5" />
                  <span className="text-[12px] font-black uppercase tracking-[0.2em]">Google</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Legal Modal */}
      <LegalModal 
        isOpen={!!showLegal} 
        onClose={() => setShowLegal(null)} 
        language={language || 'ru'} 
        type={showLegal || 'terms'} 
      />
    </div>
  );
};
