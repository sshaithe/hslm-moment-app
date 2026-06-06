import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { setAdminAuthenticated } from '@/lib/localStore';
import { useLanguage } from '@/i18n/LanguageContext';
import Logo from '@/components/shared/Logo';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';

export default function AdminLoginScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const { t } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();

  const handleLogin = () => {
    if (password === 'admin123') {
      setAdminAuthenticated(true);
      addToast(t('loginSuccess'), 'success');
      navigate('/admin/dashboard');
    } else {
      setError(true);
      addToast(t('error'), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-warm hover:text-charcoal transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-elevated">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <div className="flex justify-center mb-1">
            <Logo size="lg" />
          </div>
          <p className="text-sm text-muted-warm mt-2">{t('adminLogin')}</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder={t('password')}
              className={`w-full bg-blush/30 rounded-xl px-4 py-3.5 text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none focus:ring-2 pr-10 transition-all ${
                error ? 'ring-2 ring-red-400' : 'focus:ring-gold/30'
              }`}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-warm/50 hover:text-muted-warm"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500">Invalid password. Try &ldquo;admin123&rdquo;</p>
          )}

          <button
            onClick={handleLogin}
            className="w-full py-3.5 rounded-full gradient-gold text-white font-medium text-sm shadow-elevated hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {t('enterDashboard')}
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-warm/60 mt-6">
          {t('adminNote')}
        </p>
      </div>
    </div>
  );
}
