import { useState, useMemo, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, RefreshCw, Loader2 } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { GalleryTab, Upload } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';
import VideoThumbnail from '@/components/shared/VideoThumbnail';

export default function GalleryScreen() {
  const navigate = useNavigate();
  const { wedding, uploads, reactions, refreshUploads, refreshWeddingSettings, isSupabase } = useDatabase();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<GalleryTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [visibleCount, setVisibleCount] = useState(20);
  const PAGE_SIZE = 20;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshUploads(), refreshWeddingSettings()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Visibility-aware 5-minute polling + mount/unmount cleanup
  useEffect(() => {
    if (!isSupabase) return;

    // Refresh immediately on mount to ensure fresh state
    handleRefresh();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUploads();
        refreshWeddingSettings();
        setLastUpdated(new Date());
      }
    }, 45 * 1000); // 45-second polling (Plan B)

    return () => clearInterval(interval);
  }, [isSupabase]);

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
      .filter((u) => !u.is_hidden && u.type !== 'guestbook')
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


  return (
    <div className="min-h-screen bg-ivory pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-ivory/95 backdrop-blur-sm border-b border-accent-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-heading text-xl text-charcoal">{t('liveGallery')}</h1>
          <div className="flex items-center gap-3">
            {isSupabase && (
              <div className="flex items-center gap-1 text-[10px] text-muted-warm font-medium">
                <span>Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                  title="Refresh gallery"
                >
                  <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-live" />
              <span className="text-xs font-semibold text-green-600 tracking-wider">{t('live')}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setVisibleCount(PAGE_SIZE); }}
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
            {filteredUploads.slice(0, visibleCount).map((upload) => (
              <div key={upload.id} className="break-inside-avoid mb-3">
                <button
                  onClick={() => navigate(`/photo/${upload.id}`)}
                  className="w-full text-left focus:outline-none block"
                >
                  {upload.type === 'message' ? (
                    <MessageCard upload={upload} />
                  ) : (
                    <MediaCard upload={upload} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {filteredUploads.length > visibleCount && (
          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <p className="text-xs text-muted-warm">
              {visibleCount} / {filteredUploads.length} {language === 'tr' ? 'gösteriliyor' : 'shown'}
            </p>
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-6 py-2.5 rounded-full bg-charcoal text-ivory text-sm font-medium hover:bg-charcoal/80 transition-colors shadow-card"
            >
              {language === 'tr' ? `${Math.min(PAGE_SIZE, filteredUploads.length - visibleCount)} tane daha yükle` : `Load ${Math.min(PAGE_SIZE, filteredUploads.length - visibleCount)} more`}
            </button>
          </div>
        )}
        {filteredUploads.length > 0 && filteredUploads.length <= visibleCount && filteredUploads.length > PAGE_SIZE && (
          <p className="text-center text-xs text-muted-warm/50 py-4">
            {language === 'tr' ? 'Hepsi gösterildi' : 'All items shown'} ✓
          </p>
        )}
      </div>


    </div>
  );
}

const MediaCard = memo(function MediaCard({ upload }: { upload: Upload }) {
  const { wedding } = useDatabase();
  const { language } = useLanguage();
  const mediaUrl = getMediaUrl(upload.local_url || upload.public_url);
  const isUploading = !mediaUrl && upload.type === 'video';
  const placeholderUrl = wedding.upload_placeholder_image ? getMediaUrl(wedding.upload_placeholder_image) : null;

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
    <div className="bg-white rounded-xl overflow-hidden shadow-card">
      <div className="relative overflow-hidden bg-blush/10 min-h-[120px]">
        {isUploading && placeholderUrl ? (
          // Show admin-configured placeholder with spinner
          <>
            <img
              src={placeholderUrl || undefined}
              alt="Uploading..."
              className="w-full h-auto block object-cover opacity-80"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                <Loader2 size={20} className="text-gold animate-spin" />
              </div>
            </div>
          </>
        ) : isUploading ? (
          // Generic spinner if no placeholder configured
          <div className="w-full flex items-center justify-center" style={{ minHeight: 120 }}>
            <Loader2 size={24} className="text-gold animate-spin" />
          </div>
        ) : upload.type === 'video' ? (
          <VideoThumbnail
            src={mediaUrl!}
            thumbnailUrl={upload.thumbnail_url}
            className="w-full aspect-video block"
            seekTo={0.5}
          />
        ) : (
          <img
            src={mediaUrl || undefined}
            alt={upload.caption || ''}
            className="w-full h-auto block"
            loading="lazy"
          />
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
});

const MessageCard = memo(function MessageCard({ upload }: { upload: Upload }) {
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
});
