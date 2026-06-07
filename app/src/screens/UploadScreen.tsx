import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Film, MessageSquare, X, UploadCloud, Shield, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UploadType } from '@/lib/types';
import Sparkle from '@/components/shared/Sparkle';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import EmojiPicker from '@/components/shared/EmojiPicker';

export default function UploadScreen() {
  const navigate = useNavigate();
  const { wedding, currentGuest: guest, createUpload } = useDatabase();
  const { t } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const [uploadType, setUploadType] = useState<UploadType>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sparklePos, setSparklePos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPaused = wedding.uploads_paused;

  // Compress image client-side to save bandwidth/storage and prevent Safari memory crashes
  const compressImage = (file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas compression failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    // Revoke previous preview URL to prevent memory leaks
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    
    setFile(f);
    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    
    setFile(f);
    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);
  }, [preview]);

  const handleSubmit = async () => {
    if (!guest && wedding.require_guest_name) {
      navigate('/join');
      return;
    }

    const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
    const guestId = guest?.guest_id || 'anonymous';

    setIsUploading(true);
    setUploadProgress(0);

    let localUploadUrl = preview || undefined;
    let finalPreviewUrlToCleanup = '';

    try {
      // If uploading a photo, compress it client-side first
      if (uploadType === 'photo' && file) {
        const compressedBlob = await compressImage(file);
        localUploadUrl = URL.createObjectURL(compressedBlob);
        finalPreviewUrlToCleanup = localUploadUrl;
      }

      const upload = {
        id: uuidv4(),
        wedding_id: wedding.id,
        guest_id: guestId,
        guest_name: guestName,
        type: uploadType,
        local_url: localUploadUrl,
        caption: caption.trim() || undefined,
        message_text: uploadType === 'message' ? messageText.trim() : undefined,
        is_approved: !wedding.approve_before_display,
        is_hidden: false,
        is_featured: false,
        report_count: 0,
      };

      await createUpload(upload, (progress) => {
        setUploadProgress(progress);
      });
      setShowSuccess(true);
      addToast(t('uploadSuccessToast'), 'success');

      // Cleanup object URL
      if (finalPreviewUrlToCleanup) {
        URL.revokeObjectURL(finalPreviewUrlToCleanup);
      }

      setTimeout(() => {
        navigate('/gallery');
      }, 1200);
    } catch (err) {
      console.error('Upload error:', err);
      addToast('Upload failed. Please try again.', 'error');
      
      // Cleanup object URL on error
      if (finalPreviewUrlToCleanup) {
        URL.revokeObjectURL(finalPreviewUrlToCleanup);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = uploadType === 'message' ? messageText.trim().length > 0 : (uploadType === 'video' ? file !== null : true);

  const typeOptions: { type: UploadType; icon: typeof Camera; label: string }[] = [
    { type: 'photo', icon: Camera, label: t('photo') },
    { type: 'video', icon: Film, label: t('video') },
    { type: 'message', icon: MessageSquare, label: t('message') },
  ];

  if (isPaused) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blush flex items-center justify-center mb-4">
          <Shield size={28} className="text-gold" />
        </div>
        <h3 className="font-heading text-lg text-charcoal mb-2">{t('uploadsPaused')}</h3>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2.5 rounded-full gradient-gold text-white text-sm font-medium"
        >
          {t('liveGallery')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent-border/30 bg-white/50">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
          <ArrowLeft size={20} className="text-charcoal" />
        </button>
        <h2 className="font-heading text-lg text-charcoal">{t('newMemory')}</h2>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center">
          <X size={20} className="text-charcoal" />
        </button>
      </div>

      {isUploading ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in">
          <div className="w-full max-w-xs text-center">
            {/* Pulsing upload cloud icon */}
            <div className="w-20 h-20 rounded-full bg-blush flex items-center justify-center mx-auto mb-6 relative">
              <UploadCloud size={32} className="text-gold animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
            </div>
            
            <h3 className="font-heading text-xl text-charcoal mb-2">
              {uploadProgress < 100 ? 'Uploading your memory...' : 'Processing...'}
            </h3>
            
            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-blush rounded-full overflow-hidden mb-3 border border-accent-border/40 shadow-inner">
              <div
                className="h-full gradient-gold rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-xs text-muted-warm font-medium px-1">
              <span>{uploadProgress < 100 ? `${uploadProgress}% completed` : 'Writing to database...'}</span>
              <span>{uploadProgress < 100 ? 'Please wait' : 'Almost ready'}</span>
            </div>
          </div>
        </div>
      ) : showSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
          {sparklePos && <Sparkle x={sparklePos.x} y={sparklePos.y} />}
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="font-heading text-xl text-charcoal mb-1">{t('uploadSuccess')}</h3>
          <p className="text-sm text-muted-warm">Redirecting to gallery...</p>
        </div>
      ) : (
        <>
          {/* Greeting */}
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-heading text-xl text-charcoal">
              {guest ? t('hiName', { name: guest.first_name }) : t('welcome')}
            </h3>
            <p className="text-sm text-muted-warm mt-0.5">{t('whatToShare')}</p>
          </div>

          {/* Type Selector */}
          <div className="px-5 mb-4">
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { setUploadType(opt.type); setFile(null); setPreview(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium transition-all ${
                    uploadType === opt.type
                      ? 'bg-charcoal text-ivory'
                      : 'bg-blush text-muted-warm border border-accent-border'
                  }`}
                >
                  <opt.icon size={16} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Zone */}
          <div className="px-5 flex-1">
            {uploadType === 'message' ? (
              <div className="relative">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('writeWishes')}
                  rows={6}
                  className="w-full bg-blush rounded-xl p-4 text-charcoal placeholder:text-muted-warm/60 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none text-sm leading-relaxed pb-10"
                />
                <div className="absolute bottom-3 right-3">
                  <EmojiPicker onSelect={(emoji) => setMessageText((prev) => prev + emoji)} />
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-xl border-2 border-dashed transition-colors overflow-hidden ${
                  preview
                    ? 'border-gold/30'
                    : 'border-gold/40 hover:border-gold/70 bg-blush/30'
                }`}
                style={{ aspectRatio: '4/3' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === 'photo' ? 'image/*' : 'video/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {preview ? (
                  <div className="relative w-full h-full">
                    {uploadType === 'photo' ? (
                      <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <video src={preview} className="w-full h-full object-cover rounded-xl" controls />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-charcoal/60 flex items-center justify-center"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
                    <UploadCloud size={36} className="text-gold mb-3" strokeWidth={1.5} />
                    <p className="text-sm text-muted-warm">{t('tapToChoose')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Caption */}
            <div className="mt-4 flex items-center bg-blush/50 rounded-xl px-4 py-3 gap-1">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('addCaption')}
                className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-muted-warm/60 focus:outline-none"
              />
              <EmojiPicker onSelect={(emoji) => setCaption((prev) => prev + emoji)} />
            </div>
          </div>

          {/* Submit */}
          <div className="px-5 py-4">
            <button
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setSparklePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                handleSubmit();
              }}
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-full font-medium text-sm transition-all ${
                canSubmit
                  ? 'gradient-gold text-white shadow-elevated hover:opacity-90 active:scale-[0.98]'
                  : 'bg-charcoal/10 text-muted-warm/40 cursor-not-allowed'
              }`}
            >
              {t('shareNow')}
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <Shield size={12} className="text-muted-warm/50" />
              <span className="text-[11px] text-muted-warm/50 text-center">{t('securityNote')}</span>
            </div>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
