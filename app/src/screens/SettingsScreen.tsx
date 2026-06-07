import { useState, useRef, useEffect } from 'react';
import { Shield, Globe, MessageSquare, Image, Video, Download, Flag, Pause, Users, EyeOff, Upload, Trash2 } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import type { Wedding } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';

interface SettingItem {
  key: string;
  icon: typeof Shield;
  label: string;
  description: string;
  value: boolean;
  category: 'access' | 'content';
}

export default function SettingsScreen() {
  const { wedding, saveWeddingSettings } = useDatabase();
  const { t, language, setLanguage } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();

  const allSettings: SettingItem[] = [
    {
      key: 'is_public',
      icon: Globe,
      label: t('privateLinkAccess'),
      description: language === 'tr' ? 'Özel bağlantı ile erişime izin ver' : 'Allow access via private link',
      value: wedding.is_public,
      category: 'access',
    },
    {
      key: 'require_guest_name',
      icon: Users,
      label: t('requireGuestName'),
      description: language === 'tr' ? 'Misafirlerin adını girmesi zorunlu' : 'Require guests to enter their name',
      value: wedding.require_guest_name,
      category: 'access',
    },
    {
      key: 'is_public_gallery',
      icon: Image,
      label: t('instantPublicGallery'),
      description: language === 'tr' ? 'Yüklemeler anında galeride görünsün' : 'Uploads appear in gallery instantly',
      value: !wedding.approve_before_display,
      category: 'content',
    },
    {
      key: 'approve_before_display',
      icon: EyeOff,
      label: t('approveBeforeDisplay'),
      description: language === 'tr' ? 'Görüntülemeden önce onay gerektir' : 'Require approval before displaying',
      value: wedding.approve_before_display,
      category: 'content',
    },
    {
      key: 'slideshow_approval_mode',
      icon: Image,
      label: t('slideshowApprovalMode'),
      description: language === 'tr' ? 'Slayt için sadece onaylı içerikler' : 'Only approved content in slideshow',
      value: wedding.slideshow_approval_mode,
      category: 'content',
    },
    {
      key: 'allow_comments',
      icon: MessageSquare,
      label: t('allowComments'),
      description: language === 'tr' ? 'Misafirler yorum yapabilsin' : 'Allow guests to leave comments',
      value: wedding.allow_comments,
      category: 'content',
    },
    {
      key: 'allow_video_uploads',
      icon: Video,
      label: t('allowVideoUploads'),
      description: language === 'tr' ? 'Video yüklemelerine izin ver' : 'Allow guests to upload videos',
      value: wedding.allow_video_uploads,
      category: 'content',
    },
    {
      key: 'allow_downloads',
      icon: Download,
      label: t('allowGuestDownloads'),
      description: language === 'tr' ? 'Misafirler indirme yapabilsin' : 'Allow guests to download content',
      value: wedding.allow_downloads,
      category: 'content',
    },
    {
      key: 'auto_hide_reported',
      icon: Flag,
      label: t('autoHideReported'),
      description: language === 'tr' ? '3 bildirimde içeriği otomatik gizle' : 'Auto-hide content after 3 reports',
      value: wedding.auto_hide_reported,
      category: 'content',
    },
    {
      key: 'uploads_paused',
      icon: Pause,
      label: t('pauseAllUploads'),
      description: language === 'tr' ? 'Tüm yüklemeleri geçici durdur' : 'Temporarily pause all uploads',
      value: wedding.uploads_paused,
      category: 'content',
    },
  ];

  const accessSettings = allSettings.filter((s) => s.category === 'access');
  const contentSettings = allSettings.filter((s) => s.category === 'content');

  const handleToggle = (key: string, value: boolean) => {
    const w = { ...wedding };

    switch (key) {
      case 'is_public':
        w.is_public = value;
        break;
      case 'require_guest_name':
        w.require_guest_name = value;
        break;
      case 'is_public_gallery':
        w.approve_before_display = !value;
        break;
      case 'approve_before_display':
        w.approve_before_display = value;
        break;
      case 'slideshow_approval_mode':
        w.slideshow_approval_mode = value;
        break;
      case 'allow_comments':
        w.allow_comments = value;
        break;
      case 'allow_video_uploads':
        w.allow_video_uploads = value;
        break;
      case 'allow_downloads':
        w.allow_downloads = value;
        break;
      case 'auto_hide_reported':
        w.auto_hide_reported = value;
        break;
      case 'uploads_paused':
        w.uploads_paused = value;
        break;
    }

    saveWeddingSettings(w);
  };

  const handleSave = () => {
    addToast(t('settingsSaved'), 'success');
  };

  const toggleLanguage = () => {
    const newLang = language === 'tr' ? 'en' : 'tr';
    setLanguage(newLang);
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-charcoal">{t('settings')}</h1>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent-border text-xs font-medium text-muted-warm hover:text-gold hover:border-gold transition-colors"
        >
          <Globe size={12} />
          {language === 'tr' ? 'English' : 'Türkçe'}
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-white rounded-xl p-4 shadow-card flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-green-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-charcoal">{t('yourGalleryPrivate')}</p>
          <p className="text-xs text-muted-warm">
            {language === 'tr'
              ? 'Galeriniz sadece davetli misafirler tarafından görüntülenebilir.'
              : 'Your gallery is only viewable by invited guests.'}
          </p>
        </div>
      </div>

      {/* Access Settings */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-accent-border/20">
          <h3 className="font-medium text-charcoal text-sm">{t('accessSettings')}</h3>
        </div>
        <div className="divide-y divide-accent-border/10">
          {accessSettings.map((setting) => (
            <SettingRow
              key={setting.key}
              setting={setting}
              onToggle={(v) => handleToggle(setting.key, v)}
            />
          ))}
        </div>
      </div>

      {/* Content Settings */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-accent-border/20">
          <h3 className="font-medium text-charcoal text-sm">{t('contentSettings')}</h3>
        </div>
        <div className="divide-y divide-accent-border/10">
          {contentSettings.map((setting) => (
            <SettingRow
              key={setting.key}
              setting={setting}
              onToggle={(v) => handleToggle(setting.key, v)}
            />
          ))}
        </div>
      </div>

      {/* Photo Customization */}
      <PhotoCustomizationSection
        language={language}
        onSaved={() => addToast(t('settingsSaved'), 'success')}
        wedding={wedding}
        saveWeddingSettings={saveWeddingSettings}
      />

      {/* Welcome Message Customization */}
      <TextCustomizationSection
        language={language}
        onSaved={() => addToast(t('settingsSaved'), 'success')}
        wedding={wedding}
        saveWeddingSettings={saveWeddingSettings}
      />

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-3.5 rounded-full gradient-gold text-white font-medium text-sm shadow-elevated hover:opacity-90 active:scale-[0.98] transition-all"
      >
        {t('saveSettings')}
      </button>

      {/* Footer */}
      <p className="text-center text-[11px] text-muted-warm/50 pb-4">{t('footerNote')}</p>
    </div>
  );
}

function SettingRow({
  setting,
  onToggle,
}: {
  setting: SettingItem;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4 hover:bg-ivory/30 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-blush flex items-center justify-center flex-shrink-0">
        <setting.icon size={16} className="text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal">{setting.label}</p>
        <p className="text-xs text-muted-warm">{setting.description}</p>
      </div>
      <button
        onClick={() => onToggle(!setting.value)}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
          setting.value ? 'bg-gold' : 'bg-accent-border'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
            setting.value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Photo Customization Section ────────────────────────────────────────────
function PhotoCustomizationSection({
  language,
  onSaved,
  wedding,
  saveWeddingSettings,
}: {
  language: string;
  onSaved: () => void;
  wedding: Wedding;
  saveWeddingSettings: (updates: Partial<Wedding>) => Promise<void>;
}) {
  const w = wedding;

  const handlePhotoChange = (field: 'hero_photo' | 'couple_photo' | 'gallery_banner', file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      await saveWeddingSettings({ [field]: reader.result as string });
      onSaved();
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = async (field: 'hero_photo' | 'couple_photo' | 'gallery_banner') => {
    await saveWeddingSettings({ [field]: '' });
    onSaved();
  };

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="p-4 border-b border-accent-border/20">
        <h3 className="font-medium text-charcoal text-sm flex items-center gap-2">
          <Image size={15} className="text-gold" />
          {language === 'tr' ? 'Fotoğraf Özelleştirme' : 'Photo Customization'}
        </h3>
        <p className="text-xs text-muted-warm mt-0.5">
          {language === 'tr'
            ? 'Sayfaların görsellerini özelleştirin'
            : 'Customize the photos shown across your app'}
        </p>
      </div>
      <div className="divide-y divide-accent-border/10">
        <PhotoUploadRow
          label={language === 'tr' ? '🖼️ Ana Sayfa Arka Planı' : '🖼️ Landing Page Hero'}
          description={language === 'tr' ? 'Açılış ekranının büyük arka plan fotoğrafı' : 'The full-screen background on the landing page'}
          currentPhoto={w.hero_photo}
          onUpload={(f) => handlePhotoChange('hero_photo', f)}
          onRemove={() => handlePhotoRemove('hero_photo')}
          language={language}
        />
        <PhotoUploadRow
          label={language === 'tr' ? '💑 Çift Fotoğrafı' : '💑 Couple Portrait'}
          description={language === 'tr' ? 'Ana sayfada öne çıkan çift portresi' : 'Featured couple photo shown on the landing page'}
          currentPhoto={w.couple_photo}
          onUpload={(f) => handlePhotoChange('couple_photo', f)}
          onRemove={() => handlePhotoRemove('couple_photo')}
          language={language}
        />
        <PhotoUploadRow
          label={language === 'tr' ? '🏛️ Galeri Banner Görseli' : '🏛️ Gallery Banner'}
          description={language === 'tr' ? 'Galeri ekranının üstündeki görsel' : 'Banner image at the top of the gallery screen'}
          currentPhoto={w.gallery_banner}
          onUpload={(f) => handlePhotoChange('gallery_banner', f)}
          onRemove={() => handlePhotoRemove('gallery_banner')}
          language={language}
        />
      </div>
    </div>
  );
}

function PhotoUploadRow({
  label,
  description,
  currentPhoto,
  onUpload,
  onRemove,
  language,
}: {
  label: string;
  description: string;
  currentPhoto?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  language: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        {/* Thumbnail / Upload zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gold/30 bg-blush/30 flex-shrink-0 cursor-pointer hover:border-gold/60 transition-colors relative group"
        >
          {currentPhoto ? (
            <>
              <img src={getMediaUrl(currentPhoto) || undefined} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={16} className="text-white" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <Upload size={18} className="text-gold/50" />
              <span className="text-[9px] text-muted-warm/60 text-center leading-tight px-1">
                {language === 'tr' ? 'Yükle' : 'Tap to upload'}
              </span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Label + actions */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal">{label}</p>
          <p className="text-xs text-muted-warm mt-0.5 leading-relaxed">{description}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-medium hover:bg-gold/20 transition-colors"
            >
              <Upload size={11} />
              {currentPhoto
                ? (language === 'tr' ? 'Değiştir' : 'Change')
                : (language === 'tr' ? 'Yükle' : 'Upload')}
            </button>
            {currentPhoto && (
              <button
                onClick={onRemove}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-400 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 size={11} />
                {language === 'tr' ? 'Kaldır' : 'Remove'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Text Customization Section ─────────────────────────────────────────────
function TextCustomizationSection({
  language,
  onSaved,
  wedding,
  saveWeddingSettings,
}: {
  language: string;
  onSaved: () => void;
  wedding: Wedding;
  saveWeddingSettings: (updates: Partial<Wedding>) => Promise<void>;
}) {
  const w = wedding;
  const [quote, setQuote] = useState(w.thank_you_quote || '');

  // Keep state in sync if wedding changes
  useEffect(() => {
    setQuote(w.thank_you_quote || '');
  }, [w.thank_you_quote]);

  const handleSaveQuote = async () => {
    await saveWeddingSettings({ thank_you_quote: quote.trim() || undefined });
    onSaved();
  };

  const handleResetQuote = async () => {
    await saveWeddingSettings({ thank_you_quote: undefined });
    setQuote('');
    onSaved();
  };

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="p-4 border-b border-accent-border/20">
        <h3 className="font-medium text-charcoal text-sm flex items-center gap-2">
          <MessageSquare size={15} className="text-gold" />
          {language === 'tr' ? 'Karşılama Mesajı Özelleştirme' : 'Welcome Message Customization'}
        </h3>
        <p className="text-xs text-muted-warm mt-0.5">
          {language === 'tr'
            ? 'Ana sayfadaki karşılama veya teşekkür sözünü düzenleyin'
            : 'Edit the welcome or thank you quote shown on the landing page'}
        </p>
      </div>
      <div className="p-4 space-y-3">
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder={
            language === 'tr'
              ? 'Örn: En güzel günümüzün bir parçası olduğunuz için teşekkür ederiz...'
              : 'E.g., Thank you for being part of our most beautiful day...'
          }
          className="w-full min-h-[80px] p-3 rounded-lg border border-accent-border/40 focus:border-gold focus:outline-none text-xs text-charcoal bg-ivory/10 resize-y"
        />
        <div className="flex items-center justify-end gap-2">
          {w.thank_you_quote && (
            <button
              onClick={handleResetQuote}
              className="px-3 py-1.5 rounded-full bg-red-50 text-red-400 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              {language === 'tr' ? 'Varsayılana Sıfırla' : 'Reset to Default'}
            </button>
          )}
          <button
            onClick={handleSaveQuote}
            className="px-3 py-1.5 rounded-full bg-gold text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            {language === 'tr' ? 'Metni Güncelle' : 'Update Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

