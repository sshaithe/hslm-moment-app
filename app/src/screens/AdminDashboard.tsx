import { useNavigate } from 'react-router-dom';
import { Download, QrCode, Monitor, Pause, Play, Image, MessageSquare, Users, Clock, EyeOff, CheckCircle, Star } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Upload } from '@/lib/types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { wedding, uploads, guests, saveWeddingSettings, modifyUpload, removeUpload } = useDatabase();
  const { t } = useLanguage();

  const stats = [
    { label: t('totalUploadsStat'), value: uploads.length, icon: Image, color: 'bg-gold/10 text-gold' },
    { label: t('guestMessages'), value: uploads.filter((u) => u.type === 'message').length, icon: MessageSquare, color: 'bg-blush text-gold' },
    { label: t('pendingApproval'), value: uploads.filter((u) => !u.is_approved && !u.is_hidden).length, icon: Clock, color: 'bg-amber-50 text-amber-500' },
    { label: t('activeGuestsStat'), value: guests.length, icon: Users, color: 'bg-green-50 text-green-600' },
  ];

  const quickActions = [
    { label: t('downloadAll'), icon: Download, action: () => {} },
    { label: t('generateQR'), icon: QrCode, action: () => navigate('/admin/qr') },
    { label: t('liveSlideshow'), icon: Monitor, action: () => navigate('/admin/slideshow') },
    {
      label: wedding.uploads_paused ? t('resumeUploads') : t('pauseUploads'),
      icon: wedding.uploads_paused ? Play : Pause,
      action: () => {
        saveWeddingSettings({ uploads_paused: !wedding.uploads_paused });
      },
    },
  ];

  const recentUploads = uploads
    .filter((u) => !u.is_hidden)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const handleAction = async (upload: Upload, action: string) => {
    switch (action) {
      case 'hide':
        await modifyUpload(upload.id, { is_hidden: true });
        break;
      case 'approve':
        await modifyUpload(upload.id, { is_approved: true });
        break;
      case 'feature':
        await modifyUpload(upload.id, { is_featured: true });
        break;
      case 'delete':
        await removeUpload(upload.id);
        break;
    }
  };

  const getStatusBadge = (upload: Upload) => {
    if (!upload.is_approved) return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium">{t('pending')}</span>;
    if (upload.is_featured) return <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-medium">{t('featured')}</span>;
    return <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-medium">{t('visible')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl text-charcoal">{wedding.couple_name} &mdash; {t('weddingDashboard')}</h1>
        <p className="text-sm text-muted-warm mt-1">{new Date(wedding.wedding_date).toLocaleDateString()} &bull; {wedding.venue}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-card">
            <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={18} />
            </div>
            <p className="text-2xl font-semibold text-charcoal">{stat.value}</p>
            <p className="text-xs text-muted-warm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={action.action}
            className="bg-white rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow text-left"
          >
            <action.icon size={20} className="text-gold mb-2" />
            <p className="text-sm font-medium text-charcoal">{action.label}</p>
          </button>
        ))}
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-xl p-5 shadow-card">
        <h3 className="font-medium text-charcoal mb-4">{t('settings')}</h3>
        <div className="space-y-3">
          {[
            { key: 'is_public', label: t('publicGallery') },
            { key: 'slideshow_approval_mode', label: t('slideshowApproval') },
            { key: 'allow_comments', label: t('guestComments') },
            { key: 'allow_downloads', label: t('allowGuestDownloads') },
          ].map((toggle) => {
            const key = toggle.key as keyof typeof wedding;
            const value = wedding[key] as boolean;
            return (
              <div key={toggle.key} className="flex items-center justify-between py-2 border-b border-accent-border/20 last:border-0">
                <span className="text-sm text-charcoal">{toggle.label}</span>
                <button
                  onClick={() => {
                    saveWeddingSettings({ [key]: !value });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-gold' : 'bg-accent-border'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-accent-border/20">
          <h3 className="font-medium text-charcoal">{t('uploadsManagement')}</h3>
        </div>
        <div className="divide-y divide-accent-border/20">
          {recentUploads.map((upload) => (
            <div key={upload.id} className="flex items-center gap-3 p-4 hover:bg-ivory/50 transition-colors">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-blush flex-shrink-0">
                {upload.type === 'video' ? (
                  <video src={upload.local_url || upload.public_url} className="w-full h-full object-cover" muted playsInline />
                ) : upload.type === 'photo' ? (
                  <img src={upload.local_url || upload.public_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MessageSquare size={16} className="text-gold" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{upload.guest_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-warm capitalize">{upload.type}</span>
                  {getStatusBadge(upload)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!upload.is_approved && (
                  <button onClick={() => handleAction(upload, 'approve')} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600">
                    <CheckCircle size={16} />
                  </button>
                )}
                <button onClick={() => handleAction(upload, 'feature')} className={`p-1.5 rounded-lg hover:bg-gold/10 ${upload.is_featured ? 'text-gold' : 'text-muted-warm'}`}>
                  <Star size={16} />
                </button>
                <button onClick={() => handleAction(upload, 'hide')} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-warm hover:text-red-500">
                  <EyeOff size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
