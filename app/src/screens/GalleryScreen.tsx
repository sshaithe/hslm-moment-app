import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mail } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { GalleryTab, Upload } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';

export default function GalleryScreen() {
  const navigate = useNavigate();
  const { wedding, uploads, reactions } = useDatabase();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<GalleryTab>('all');

  const tabs: { key: GalleryTab; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'photos', label: t('photos') },
    { key: 'videos', label: t('videosTab') },
    { key: 'messages', label: t('messagesTab') },
    { key: 'popular', label: t('popular') },
  ];

  const filteredUploads = useMemo(() => {
    // Exclude uploads with stale blob: URLs that expired after page refresh
    let result = uploads
      .filter((u) => !u.is_hidden)
      .filter((u) => {
        const url = u.local_url || u.public_url;
        // Skip media uploads (photo/video) that have no viewable URL at all
        if (u.type !== 'message' && !url) return false;
        return u.type === 'message' || !url || !url.startsWith('blob:');
      });

    if (wedding.approve_before_display) {
      result = result.filter((u) => u.is_approved);
    }

    switch (activeTab) {
      case 'photos':
        result = result.filter((u) => u.type === 'photo');
        break;
      case 'videos':
        result = result.filter((u) => u.type === 'video');
        break;
      case 'messages':
        result = result.filter((u) => u.type === 'message');
        break;
      case 'popular':
        result = [...result].sort((a, b) => {
          const aCount = reactions.filter((r) => r.upload_id === a.id).length;
          const bCount = reactions.filter((r) => r.upload_id === b.id).length;
          return bCount - aCount;
        });
        break;
      default:
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [uploads, reactions, activeTab, wedding.approve_before_display]);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return new Date(dateStr).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-ivory pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-ivory/95 backdrop-blur-sm border-b border-accent-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-heading text-xl text-charcoal">{t('liveGallery')}</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-live" />
            <span className="text-xs font-semibold text-green-600 tracking-wider">{t('live')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-charcoal text-ivory'
                  : 'bg-blush/60 text-muted-warm hover:bg-blush'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Banner (admin-set) */}
      {wedding.gallery_banner && (
        <div className="relative h-32 overflow-hidden">
          <img src={getMediaUrl(wedding.gallery_banner) || undefined} alt="Gallery banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ivory/80" />
        </div>
      )}

      {/* Masonry Grid */}
      <div className="px-3 pt-3">
        {filteredUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-blush flex items-center justify-center mb-4">
              <Mail size={24} className="text-gold" />
            </div>
            <p className="font-heading italic text-muted-warm text-sm">
              {t('noMemories')}
            </p>
          </div>
        ) : (
          <div className="columns-2 gap-3">
            {filteredUploads.map((upload) => (
              <div key={upload.id} className="break-inside-avoid mb-3">
                <button
                  onClick={() => navigate(`/photo/${upload.id}`)}
                  className="w-full text-left focus:outline-none block"
                >
                  {upload.type === 'message' ? (
                    <MessageCard upload={upload} />
                  ) : (
                    <MediaCard upload={upload} formatTime={formatTime} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/upload')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full gradient-gold shadow-elevated flex items-center justify-center z-40 hover:opacity-90 active:scale-95 transition-all"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}

function MediaCard({ upload, formatTime }: { upload: Upload; formatTime: (d: string) => string }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-card">
      <div className="relative overflow-hidden bg-blush/10 min-h-[120px]">
        {upload.type === 'video' ? (
          <video
            src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
            className="w-full h-auto block object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
            alt={upload.caption || ''}
            className="w-full h-auto block"
          />
        )}
        {upload.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[14px] border-l-charcoal border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent ml-1" />
            </div>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-charcoal">{upload.guest_name}</p>
        {upload.caption && (
          <p className="text-[11px] text-muted-warm mt-0.5 line-clamp-1">{upload.caption}</p>
        )}
        <p className="text-[10px] text-muted-warm/60 mt-1">{formatTime(upload.created_at)}</p>
      </div>
    </div>
  );
}

function MessageCard({ upload }: { upload: Upload }) {
  return (
    <div className="bg-blush rounded-xl p-4 relative overflow-hidden shadow-card">
      <span className="absolute top-2 right-3 font-heading text-4xl text-gold/20 leading-none">&rdquo;</span>
      <p className="font-heading italic text-sm text-charcoal leading-relaxed relative z-10">
        &ldquo;{upload.message_text}&rdquo;
      </p>
      <div className="mt-3 pt-2 border-t border-accent-border/40">
        <p className="text-xs font-medium text-charcoal">{upload.guest_name}</p>
      </div>
    </div>
  );
}
