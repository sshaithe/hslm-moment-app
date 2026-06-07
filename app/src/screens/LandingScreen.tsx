import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Image, Users, Mail, Video, Lock } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import GoldDivider from '@/components/shared/GoldDivider';
import { getMediaUrl } from '@/lib/mediaHelper';

export default function LandingScreen() {
  const navigate = useNavigate();
  const { wedding, uploads, guests } = useDatabase();
  const { t, language } = useLanguage();

  const stats = [
    { icon: Image, label: t('totalUploads'), value: uploads.length },
    { icon: Users, label: t('activeGuests'), value: guests.length },
    { icon: Mail, label: t('messages'), value: uploads.filter((u) => u.type === 'message').length },
    { icon: Video, label: t('videos'), value: uploads.filter((u) => u.type === 'video').length },
  ];

  const visibleUploads = uploads
    .filter((u) => !u.is_hidden)
    .filter((u) => {
      const url = u.local_url || u.public_url;
      return !url || !url.startsWith('blob:');
    })
    .slice(0, 10);

  const heroSrc = getMediaUrl(wedding.hero_photo) || '/hero-wedding.jpg';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (language === 'tr') {
      const months = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
      const days = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
    }
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="relative h-[70vh] min-h-[500px]">
        <img
          src={heroSrc || undefined}
          alt="Wedding"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 gradient-overlay" />

        {/* Top Nav */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-heading text-ivory text-lg font-medium">HSLM Moment</span>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal/60 backdrop-blur-sm text-ivory text-xs font-medium hover:bg-charcoal/80 transition-colors"
            >
              <Lock size={12} />
              {t('adminAccess')}
            </button>
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 text-center">
          <h1 className="font-heading text-4xl md:text-5xl text-ivory italic text-shadow-soft mb-3">
            {wedding.couple_name}
          </h1>
          <GoldDivider width="w-12" className="mb-4 opacity-80" />
          <div className="flex items-center justify-center gap-4 text-ivory/80 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(wedding.wedding_date)}
            </span>
            <span className="w-px h-3 bg-ivory/40" />
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {wedding.venue}
            </span>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-ivory -mt-6 rounded-t-3xl relative z-10 px-5 pt-8 pb-4">
        {/* Quote */}
        <p className="font-heading italic text-center text-muted-warm text-base leading-relaxed mb-8 px-4">
          &ldquo;{wedding.thank_you_quote || t('thankYouQuote')}&rdquo;
        </p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center py-3">
              <stat.icon size={20} className="mx-auto mb-1.5 text-gold" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-charcoal">{stat.value}</p>
              <p className="text-[10px] text-muted-warm uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Couple Portrait (if admin uploaded one) */}
        {wedding.couple_photo && (
          <div className="flex justify-center mb-8">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gold/30 shadow-elevated ring-2 ring-ivory">
              <img src={getMediaUrl(wedding.couple_photo) || undefined} alt="Couple" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* Preview Strip */}
        {visibleUploads.length > 0 && (
          <div className="mb-8">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
              {visibleUploads.map((upload) => (
                <button
                  key={upload.id}
                  onClick={() => navigate(`/photo/${upload.id}`)}
                  className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden shadow-card"
                >
                  {upload.type === 'video' ? (
                    <div className="relative w-full h-full">
                      <video
                        src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                          <div className="w-0 h-0 border-l-[8px] border-l-charcoal border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : upload.type === 'photo' ? (
                    <img
                      src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blush flex items-center justify-center">
                      <Mail size={20} className="text-gold" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/upload')}
            className="w-full py-3.5 rounded-full gradient-gold text-white font-medium text-sm shadow-elevated hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {t('uploadMemories')}
          </button>
          <button
            onClick={() => navigate('/gallery')}
            className="w-full py-3.5 rounded-full border border-charcoal/20 text-charcoal font-medium text-sm hover:bg-charcoal/5 transition-colors active:scale-[0.98]"
          >
            {t('viewLiveGallery')}
          </button>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
