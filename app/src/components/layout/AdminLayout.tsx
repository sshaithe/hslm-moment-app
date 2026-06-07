import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, Image, QrCode, Monitor, Settings, LogOut, Users } from 'lucide-react';
import { isAdminAuthenticated } from '@/lib/localStore';
import { useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import Logo from '@/components/shared/Logo';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate('/admin');
    }
  }, [navigate]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/admin/uploads', icon: Upload, label: t('uploadsManagement') },
    { path: '/admin/gallery', icon: Image, label: t('gallery') },
    { path: '/admin/qr', icon: QrCode, label: t('qrCode') },
    { path: '/admin/slideshow', icon: Monitor, label: t('slideshow') },
    { path: '/admin/settings', icon: Settings, label: t('settings') },
    { path: '/admin/guests', icon: Users, label: t('guests') },
  ];

  const handleLogout = () => {
    localStorage.removeItem('vv_admin_auth');
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-accent-border/40 sticky top-0 h-screen">
        <div className="p-6 flex items-center justify-between">
          <Logo size="md" />
          <LanguageSwitcher />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted-warm hover:text-charcoal hover:bg-blush/50'
              }`}
            >
              {isActive(item.path) && (
                <div className="absolute left-0 w-0.5 h-6 bg-gold rounded-r-full" />
              )}
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-accent-border/30">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-warm hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-accent-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <span className="text-sm font-medium text-charcoal">{t('weddingDashboard')}</span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button onClick={handleLogout} className="text-muted-warm hover:text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        {/* Mobile Scrollable Nav */}
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isActive(item.path)
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted-warm hover:text-charcoal'
              }`}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-24 md:pt-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
