import { useState, useEffect } from 'react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import type { Guest } from '@/lib/types';

export default function AdminGuestsScreen() {
  const { guests, toggleGuestBan, refreshGuests, isSupabase } = useDatabase();
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingGuestId, setUpdatingGuestId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshGuests();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Visibility-aware 5-minute polling + cleanup
  useEffect(() => {
    if (!isSupabase) return;

    handleRefresh();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshGuests();
        setLastUpdated(new Date());
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isSupabase]);

  const filteredGuests = guests.filter((guest) => {
    const fullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const handleToggleBan = async (guest: Guest) => {
    const isBanned = !!guest.is_banned;
    const confirmMsg = isBanned
      ? t('unbanConfirm') || `Are you sure you want to unban ${guest.first_name} ${guest.last_name}?`
      : t('banConfirm') || `Are you sure you want to ban ${guest.first_name} ${guest.last_name}? Banned users cannot view the gallery or upload media.`;

    if (window.confirm(confirmMsg)) {
      setUpdatingGuestId(guest.id);
      try {
        await toggleGuestBan(guest.id, !isBanned);
      } finally {
        setUpdatingGuestId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl text-charcoal">{t('guests')}</h1>
          <p className="text-sm text-muted-warm mt-1">
            {t('guestsSubtitle') || 'Manage guest gallery access and ban suspicious users.'}
          </p>
        </div>
        {isSupabase && (
          <div className="flex items-center gap-2 self-start sm:self-center text-xs text-muted-warm font-medium bg-white px-3 py-1.5 rounded-xl shadow-card border border-accent-border/10">
            <span>Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50 flex items-center justify-center"
              title="Refresh guests"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-warm" />
          <input
            type="text"
            placeholder={t('searchGuests') || 'Search guests...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-accent-border/30 focus:outline-none focus:ring-1 focus:ring-gold text-sm text-charcoal placeholder:text-muted-warm/60"
          />
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-accent-border/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ivory/50 border-b border-accent-border/20 text-xs font-semibold text-muted-warm uppercase tracking-wider">
                <th className="px-6 py-4">{t('guest')}</th>
                <th className="px-6 py-4">{t('tableNumber')}</th>
                <th className="px-6 py-4">{t('joinedAt')}</th>
                <th className="px-6 py-4">{t('statusCol')}</th>
                <th className="px-6 py-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent-border/10 text-sm">
              {filteredGuests.length > 0 ? (
                filteredGuests.map((guest) => {
                  const isBanned = !!guest.is_banned;
                  return (
                    <tr key={guest.id} className="hover:bg-ivory/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                            isBanned ? 'bg-rose-50 text-rose-500' : 'gradient-gold text-white'
                          }`}>
                            {guest.first_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-charcoal">{guest.first_name} {guest.last_name}</p>
                            <p className="text-[10px] text-muted-warm select-all">{guest.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-charcoal font-medium">
                        {guest.table_number || '—'}
                      </td>
                      <td className="px-6 py-4 text-muted-warm text-xs font-mono">
                        {new Date(guest.joined_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-medium">
                            <ShieldAlert size={12} />
                            {t('banned')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium">
                            <ShieldCheck size={12} />
                            {t('active')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          disabled={updatingGuestId === guest.id}
                          onClick={() => handleToggleBan(guest)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isBanned
                              ? 'bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50'
                          }`}
                        >
                          {updatingGuestId === guest.id ? '...' : isBanned ? t('unban') : t('ban')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-warm">
                    {t('noResults') || 'No guests found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
