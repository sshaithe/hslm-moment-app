import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RefreshCw, Book, PenLine, Camera, X, Send, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import GoldDivider from '@/components/shared/GoldDivider';
import type { Upload } from '@/lib/types';

// ─── Drawing Palette ────────────────────────────────────────────────────────
const PALETTE = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Gold', hex: '#c9a84c' },
  { name: 'Rose', hex: '#e07b8a' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Sage', hex: '#7a9e7e' },
];

const LINE_SIZES = [2, 4, 7, 12];

// ─── Signature Canvas Component ──────────────────────────────────────────────
function SignatureCanvas({
  onDrawn,
  isEmpty,
  setIsEmpty,
  eraserLabel,
  drawHint,
}: {
  onDrawn: (dataUrl: string) => void;
  isEmpty: boolean;
  setIsEmpty: (v: boolean) => void;
  eraserLabel: string;
  drawHint: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState('#1a1a1a');
  const [lineSize, setLineSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // Setup canvas DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPoint.current = getPos(e, canvas);
    setIsEmpty(false);
    if ('touches' in e) e.preventDefault();
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const current = getPos(e, canvas);
    const last = lastPoint.current!;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);

    // Smooth Bezier curve
    const midX = (last.x + current.x) / 2;
    const midY = (last.y + current.y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);

    ctx.strokeStyle = isEraser ? '#fffdf9' : color;
    ctx.lineWidth = isEraser ? lineSize * 4 : lineSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = isEraser ? 1 : 0.92;
    ctx.stroke();

    lastPoint.current = current;
    if ('touches' in e) e.preventDefault();
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      onDrawn(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
    onDrawn('');
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Palette */}
        <div className="flex items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              onClick={() => { setColor(c.hex); setIsEraser(false); }}
              title={c.name}
              style={{ background: c.hex }}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                color === c.hex && !isEraser ? 'border-charcoal scale-110 shadow-md' : 'border-white/60 hover:scale-105'
              }`}
            />
          ))}
        </div>

        {/* Sizes */}
        <div className="flex items-center gap-1.5">
          {LINE_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setLineSize(s)}
              title={`${s}px`}
              className={`rounded-full border-2 flex items-center justify-center transition-all ${
                lineSize === s && !isEraser
                  ? 'border-gold bg-gold/10'
                  : 'border-accent-border/40 hover:border-gold/40'
              }`}
              style={{ width: 28, height: 28 }}
            >
              <div
                className="rounded-full bg-charcoal"
                style={{ width: Math.min(s * 2.5, 20), height: Math.min(s * 2.5, 20) }}
              />
            </button>
          ))}
        </div>

        {/* Eraser + Clear */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isEraser ? 'bg-gold text-white border-gold' : 'border-accent-border/40 text-muted-warm hover:border-gold'
            }`}
          >
            {eraserLabel}
          </button>
          <button
            onClick={clearCanvas}
            title="Clear canvas"
            className="p-1.5 rounded-full text-muted-warm hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-gold/40 bg-[#fffdf9] shadow-inner select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          className="w-full touch-none"
          style={{ height: 200, cursor: isEraser ? 'cell' : 'crosshair', display: 'block' }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenLine size={28} className="text-gold/25 mb-1" />
            <p className="text-xs text-muted-warm/40 font-medium">{drawHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GuestBook Entry Card ────────────────────────────────────────────────────
function GuestBookCard({ entry, language }: { entry: Upload; language: string }) {
  const date = new Date(entry.created_at).toLocaleDateString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { month: 'long', day: 'numeric', year: 'numeric' }
  );

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-accent-border/20 animate-slide-up">
      {/* Drawing */}
      {entry.drawing_data_url && (
        <div className="bg-[#fffdf9] border-b border-accent-border/20 flex items-center justify-center" style={{ maxHeight: 140 }}>
          <img
            src={entry.drawing_data_url}
            alt="Guest signature"
            className="w-full object-contain"
            style={{ maxHeight: 140 }}
          />
        </div>
      )}

      {/* Optional Photo */}
      {(entry.local_url || entry.public_url) && (
        <div className="w-full" style={{ maxHeight: 180, overflow: 'hidden' }}>
          <img
            src={entry.local_url || entry.public_url}
            alt={entry.caption || 'Guest photo'}
            className="w-full object-cover"
            style={{ maxHeight: 180 }}
          />
        </div>
      )}

      {/* Text Content */}
      <div className="p-4">
        {entry.message_text && (
          <p className="font-heading italic text-sm text-charcoal leading-relaxed mb-3">
            &ldquo;{entry.message_text}&rdquo;
          </p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-charcoal">{entry.guest_name}</p>
            <p className="text-[11px] text-muted-warm">{date}</p>
          </div>
          <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
            <span className="text-white text-xs font-bold">{entry.guest_name[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function GuestBookScreen() {
  const navigate = useNavigate();
  const { wedding, currentGuest: guest, uploads, createUpload, refreshUploads, isSupabase } = useDatabase();
  const { t, language } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();

  const [showComposer, setShowComposer] = useState(false);
  const [wishText, setWishText] = useState('');
  const [drawingDataUrl, setDrawingDataUrl] = useState('');
  const [isDrawingEmpty, setIsDrawingEmpty] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Restore text draft
  useEffect(() => {
    const saved = localStorage.getItem('vv_guestbook_wish');
    if (saved) setWishText(saved);
  }, []);

  const handleWishChange = (val: string) => {
    setWishText(val);
    localStorage.setItem('vv_guestbook_wish', val);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUploads();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 5-minute visibility-aware polling
  useEffect(() => {
    if (!isSupabase) return;
    if (intervalRef.current) return; // StrictMode guard

    // Load initial data on mount
    handleRefresh();

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUploads();
        setLastUpdated(new Date());
      }
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSupabase]);

  // Guest registration check
  useEffect(() => {
    if (!guest && wedding.require_guest_name) {
      navigate('/join?redirect=/guestbook');
    }
  }, [guest, wedding.require_guest_name, navigate]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const canSubmit = !isSubmitting && (wishText.trim().length > 0 || !isDrawingEmpty);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
      const guestId = guest?.guest_id || 'anonymous';

      const upload = {
        id: uuidv4(),
        wedding_id: wedding.id,
        guest_id: guestId,
        guest_name: guestName,
        type: 'guestbook' as const,
        local_url: photoPreview || undefined,
        caption: photoFile?.name,
        message_text: wishText.trim() || undefined,
        drawing_data_url: drawingDataUrl || undefined,
        is_approved: !wedding.approve_before_display,
        is_hidden: false,
        is_featured: false,
        report_count: 0,
      };

      await createUpload(upload);

      // Clear state
      setWishText('');
      localStorage.removeItem('vv_guestbook_wish');
      setDrawingDataUrl('');
      setIsDrawingEmpty(true);
      removePhoto();
      setShowComposer(false);
      setShowSuccess(true);
      addToast(t('guestBookAdded'), 'success');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Guest book submission error:', err);
      addToast(t('guestBookError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const entries = uploads.filter(
    (u) => u.type === 'guestbook' && !u.is_hidden && (!wedding.approve_before_display || u.is_approved)
  );

  return (
    <div className="min-h-screen bg-ivory pb-24">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="text-center pt-6 pb-4 px-6 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-5 w-8 h-8 flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-charcoal" />
        </button>

        {isSupabase && (
          <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] text-muted-warm font-medium">
            <span>
              Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-center mb-2">
          <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center shadow-elevated">
            <Book size={22} className="text-white" />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gold mb-1">
          {t('guestBookSubtitle')}
        </p>
        <h1 className="font-heading text-3xl text-charcoal italic">
          {t('guestBook')}
        </h1>
        <GoldDivider width="w-12" className="my-3" />
        <p className="text-sm text-muted-warm">
          {t('guestBookEntries', { count: String(entries.length) })}
        </p>
      </div>

      {/* Sign the Book Button */}
      {!showComposer && (
        <div className="px-5 mb-6">
          <button
            onClick={() => setShowComposer(true)}
            className="w-full py-4 rounded-full gradient-gold text-white text-sm font-medium flex items-center justify-center gap-2 shadow-elevated hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <PenLine size={18} />
            {t('signGuestBook')}
          </button>
        </div>
      )}

      {/* Success Banner */}
      {showSuccess && (
        <div className="mx-5 mb-4 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 animate-slide-up">
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">
            {t('guestBookAdded')}
          </p>
        </div>
      )}

      {/* Composer */}
      {showComposer && (
        <div className="mx-4 mb-6 bg-white rounded-3xl shadow-elevated border border-gold/20 overflow-hidden animate-slide-up">
          {/* Composer Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-accent-border/20">
            <h3 className="font-heading text-lg text-charcoal">
              {t('leaveYourMark')}
            </h3>
            <button
              onClick={() => setShowComposer(false)}
              className="w-7 h-7 rounded-full bg-blush/60 flex items-center justify-center text-muted-warm hover:text-charcoal transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Signature Section */}
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
                ✍️ {t('yourSignature')}
              </label>
              <SignatureCanvas
                onDrawn={setDrawingDataUrl}
                isEmpty={isDrawingEmpty}
                setIsEmpty={setIsDrawingEmpty}
                eraserLabel={t('eraser')}
                drawHint={t('drawHint')}
              />
            </div>

            {/* Text Wish */}
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
                💌 {t('yourWish')}
              </label>
              <textarea
                value={wishText}
                onChange={(e) => handleWishChange(e.target.value)}
                placeholder={t('writeWishes')}
                rows={3}
                className="w-full bg-blush/30 rounded-xl p-3 text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
              />
            </div>

            {/* Optional Photo */}
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
                📸 {t('optionalPhoto')}
              </label>
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gold/30">
                  <img
                    src={photoPreview}
                    alt="Selected photo"
                    className="w-full object-cover"
                    style={{ maxHeight: 180 }}
                  />
                  <button
                    onClick={removePhoto}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-charcoal/60 flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-gold/30 bg-blush/20 text-sm text-muted-warm flex items-center justify-center gap-2 hover:border-gold/50 hover:bg-blush/30 transition-colors"
                >
                  <Camera size={16} />
                  {t('addPhoto')}
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-2 border-t border-accent-border/20 flex items-center justify-between gap-3">
            <button
              onClick={() => setShowComposer(false)}
              className="px-5 py-2.5 rounded-full border border-accent-border/40 text-sm text-muted-warm hover:bg-blush transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                canSubmit
                  ? 'gradient-gold text-white shadow-elevated hover:opacity-90 active:scale-[0.98]'
                  : 'bg-charcoal/10 text-muted-warm/40 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={16} />
                  {t('signTheBook')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="px-4 space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <Book size={40} className="mx-auto text-gold/25 mb-3" />
            <p className="font-heading italic text-muted-warm text-sm">
              {t('guestBookEmpty')}
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <GuestBookCard key={entry.id} entry={entry} language={language} />
          ))
        )}
      </div>
    </div>
  );
}
