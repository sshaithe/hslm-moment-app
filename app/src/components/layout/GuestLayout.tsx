import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Upload, Image, MessageSquare, User } from 'lucide-react';
import { getGuestSession } from '@/lib/localStore';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useDatabase } from '@/context/DatabaseContext';

export default function GuestLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const guest = getGuestSession();
  const { t } = useLanguage();
  const { wedding } = useDatabase();

  const isActive = (path: string) => {
    if (path === '/' || path.startsWith('/wedding/')) {
      return location.pathname === '/' || location.pathname.startsWith('/wedding/');
    }
    return location.pathname === path;
  };

  const navItems = [
    { 
      path: wedding?.slug ? `/wedding/${wedding.slug}` : '/', 
      icon: Home, 
      label: t('liveGallery').split(' ')[0] || 'Home' 
    },
    { path: '/upload', icon: Upload, label: t('uploadMemories').split(' ').slice(-1)[0] || 'Upload' },
    { path: '/gallery', icon: Image, label: t('gallery') || 'Gallery' },
    { path: '/messages', icon: MessageSquare, label: t('messages') || 'Messages' },
  ];

  return (
    <div className="min-h-screen bg-ivory flex flex-col relative">
      {/* Top bar */}
      <div className="sticky top-0 z-50 gradient-glass border-b border-accent-border/30">
        <div className="max-w-[430px] mx-auto flex items-center justify-between px-4 py-3">
          <span className="font-heading text-lg text-charcoal">HSLM Moment</span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {guest ? (
              <div className="w-7 h-7 rounded-full gradient-gold flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {guest.first_name[0]}
                </span>
              </div>
            ) : (
              <button
                onClick={() => navigate('/join')}
                className="w-7 h-7 rounded-full bg-blush flex items-center justify-center"
              >
                <User size={14} className="text-muted-warm" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 w-full max-w-[430px] mx-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-50 bg-white/90 backdrop-blur-md border-t border-accent-border/40">
        <div className="max-w-[430px] mx-auto flex items-center justify-around py-2 pb-[env(safe-area-inset-bottom,8px)]">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive(item.path)
                  ? 'text-gold'
                  : 'text-muted-warm hover:text-charcoal'
              }`}
            >
              <item.icon size={22} strokeWidth={isActive(item.path) ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
