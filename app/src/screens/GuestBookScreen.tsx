import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RefreshCw, Book, PenLine, Camera, X, Send, CheckCircle, Layout, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import GoldDivider from '@/components/shared/GoldDivider';
import type { Upload } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';

// ─── Drawing Palette ────────────────────────────────────────────────────────
const PALETTE = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Gold', hex: '#c9a84c' },
  { name: 'Rose', hex: '#e07b8a' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Sage', hex: '#7a9e7e' },
];

const LINE_SIZES = [2, 4, 7, 12];

interface PlacedSticker {
  id: string;
  type: 'emoji' | 'text';
  value: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

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

  // Enhanced state
  const [bgTemplate, setBgTemplate] = useState<'cream' | 'gold' | 'blush' | 'sage' | 'lines'>('cream');
  const [brushType, setBrushType] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [isCalligraphy, setIsCalligraphy] = useState(true);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [activeCanvasTab, setActiveCanvasTab] = useState<'draw' | 'template' | 'stickers'>('draw');

  const { t, language } = useLanguage();

  // Stable callback ref to prevent infinite rendering loops
  const onDrawnRef = useRef(onDrawn);
  useEffect(() => {
    onDrawnRef.current = onDrawn;
  }, [onDrawn]);

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
    ctx.clearRect(0, 0, rect.width, rect.height);
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
    const pos = getPos(e, canvas);
    lastPoint.current = pos;
    setIsEmpty(false);
    setSelectedStickerId(null); // deselect stickers on draw
    if ('touches' in e) e.preventDefault();

    // Draw single point on start to support tapping
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y);
    ctx.lineWidth = isEraser ? lineSize * 4 : lineSize;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = isEraser ? 1 : 0.92;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.setLineDash([]);
    ctx.stroke();
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
    ctx.lineTo(current.x, current.y);

    if (isCalligraphy && !isEraser) {
      const dx = current.x - last.x;
      const dy = current.y - last.y;
      const dist = Math.hypot(dx, dy);
      // Faster movement produces elegant thinner calligraphy strokes
      const targetWidth = Math.max(1, lineSize * (1.2 - Math.min(dist / 8, 0.8)));
      ctx.lineWidth = targetWidth;
    } else {
      ctx.lineWidth = isEraser ? lineSize * 4 : lineSize;
    }

    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = isEraser ? 1 : 0.92;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

    // Set brush line style
    if (isEraser) {
      ctx.setLineDash([]);
    } else if (brushType === 'dashed') {
      ctx.setLineDash([lineSize * 2.5, lineSize * 2.5]);
    } else if (brushType === 'dotted') {
      ctx.setLineDash([1, lineSize * 2.5]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();

    lastPoint.current = current;
    if ('touches' in e) e.preventDefault();
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPoint.current = null;
    compileCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
    setPlacedStickers([]);
    setSelectedStickerId(null);
  };

  // Compile separate layers into a single image to pass to onDrawn
  const compileCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const compileCanvas = document.createElement('canvas');
    compileCanvas.width = canvas.width;
    compileCanvas.height = canvas.height;
    const ctx = compileCanvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Draw Background Template
    if (bgTemplate === 'cream') {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, w, h);
    } else if (bgTemplate === 'gold') {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(9, 9, w - 18, h - 18);
    } else if (bgTemplate === 'blush') {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, w, h);
      let grad = ctx.createRadialGradient(0, 0, 5, 0, 0, w * 0.7);
      grad.addColorStop(0, 'rgba(224, 123, 138, 0.2)');
      grad.addColorStop(1, 'rgba(224, 123, 138, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      grad = ctx.createRadialGradient(w, h, 5, w, h, w * 0.7);
      grad.addColorStop(0, 'rgba(224, 123, 138, 0.2)');
      grad.addColorStop(1, 'rgba(224, 123, 138, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgTemplate === 'sage') {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, w, h);
      let grad = ctx.createRadialGradient(w, 0, 5, w, 0, w * 0.7);
      grad.addColorStop(0, 'rgba(122, 158, 126, 0.25)');
      grad.addColorStop(1, 'rgba(122, 158, 126, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      grad = ctx.createRadialGradient(0, h, 5, 0, h, w * 0.7);
      grad.addColorStop(0, 'rgba(122, 158, 126, 0.25)');
      grad.addColorStop(1, 'rgba(122, 158, 126, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (bgTemplate === 'lines') {
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
      ctx.lineWidth = 1;
      const spacing = h / 6;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(15, i * spacing);
        ctx.lineTo(w - 15, i * spacing);
        ctx.stroke();
      }
    }

    // 2. Draw brush strokes (the drawings)
    ctx.drawImage(canvas, 0, 0, w, h);

    // 3. Draw Stickers
    placedStickers.forEach((st) => {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate((st.rotation * Math.PI) / 180);
      ctx.scale(st.scale, st.scale);

      if (st.type === 'text') {
        ctx.font = 'italic 15px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#B8975A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.value, 0, 0);
      } else {
        ctx.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.value, 0, 0);
      }
      ctx.restore();
    });

    onDrawnRef.current(compileCanvas.toDataURL('image/png'));
  };

  // Compile automatically when stickers or background templates change
  useEffect(() => {
    compileCanvas();
  }, [placedStickers, bgTemplate]);

  // Sticker drag/transform setup
  const activeDragRef = useRef<{
    stickerId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    mode: 'drag' | 'transform';
    initialScale: number;
    initialRotation: number;
    centerX: number;
    centerY: number;
    initialAngle: number;
    initialDist: number;
  } | null>(null);

  const addSticker = (type: 'emoji' | 'text', value: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const w = rect?.width || 300;
    const h = rect?.height || 200;
    const newSticker: PlacedSticker = {
      id: uuidv4(),
      type,
      value,
      x: w / 2,
      y: h / 2,
      scale: 1.0,
      rotation: 0,
    };
    setPlacedStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  const deleteSticker = (id: string) => {
    setPlacedStickers((prev) => prev.filter((s) => s.id !== id));
    setSelectedStickerId(null);
  };

  const startStickerDrag = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    const st = placedStickers.find((s) => s.id === id);
    if (!st) return;

    setSelectedStickerId(id);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    activeDragRef.current = {
      stickerId: id,
      startX: clientX,
      startY: clientY,
      initialX: st.x,
      initialY: st.y,
      mode: 'drag',
      initialScale: st.scale,
      initialRotation: st.rotation,
      centerX: 0,
      centerY: 0,
      initialAngle: 0,
      initialDist: 0,
    };
  };

  const startStickerTransform = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const st = placedStickers.find((s) => s.id === id);
    if (!st) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const centerClientX = canvasRect.left + st.x;
    const centerClientY = canvasRect.top + st.y;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerClientX;
    const dy = clientY - centerClientY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    activeDragRef.current = {
      stickerId: id,
      startX: clientX,
      startY: clientY,
      initialX: st.x,
      initialY: st.y,
      mode: 'transform',
      initialScale: st.scale,
      initialRotation: st.rotation,
      centerX: centerClientX,
      centerY: centerClientY,
      initialAngle: angle,
      initialDist: dist || 1,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const active = activeDragRef.current;
      if (!active) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      setPlacedStickers((prev) =>
        prev.map((st) => {
          if (st.id !== active.stickerId) return st;

          if (active.mode === 'drag') {
            const dx = clientX - active.startX;
            const dy = clientY - active.startY;
            return {
              ...st,
              x: active.initialX + dx,
              y: active.initialY + dy,
            };
          } else if (active.mode === 'transform') {
            const dx = clientX - active.centerX;
            const dy = clientY - active.centerY;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const scaleChange = dist / active.initialDist;
            const rotationChange = ((angle - active.initialAngle) * 180) / Math.PI;

            return {
              ...st,
              scale: Math.max(0.4, Math.min(2.5, active.initialScale * scaleChange)),
              rotation: (active.initialRotation + rotationChange) % 360,
            };
          }
          return st;
        })
      );
    };

    const handleEnd = () => {
      if (activeDragRef.current) {
        activeDragRef.current = null;
        compileCanvas();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [placedStickers]);

  return (
    <div className="space-y-4">
      {/* Mode Selectors */}
      <div className="flex border-b border-accent-border/20 mb-1">
        <button
          onClick={() => setActiveCanvasTab('draw')}
          className={`flex-1 pb-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeCanvasTab === 'draw' ? 'border-gold text-gold' : 'border-transparent text-muted-warm/60'
          }`}
        >
          <PenLine size={13} />
          {t('draw')}
        </button>
        <button
          onClick={() => setActiveCanvasTab('template')}
          className={`flex-1 pb-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeCanvasTab === 'template' ? 'border-gold text-gold' : 'border-transparent text-muted-warm/60'
          }`}
        >
          <Layout size={13} />
          {t('template')}
        </button>
        <button
          onClick={() => setActiveCanvasTab('stickers')}
          className={`flex-1 pb-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeCanvasTab === 'stickers' ? 'border-gold text-gold' : 'border-transparent text-muted-warm/60'
          }`}
        >
          <Sparkles size={13} />
          {t('stickers')}
        </button>
      </div>

      {/* Editor controls container */}
      <div className="min-h-[50px] flex items-center">
        {/* Draw Tab */}
        {activeCanvasTab === 'draw' && (
          <div className="w-full flex items-center justify-between gap-2 flex-wrap animate-fade-in">
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

            {/* Brush Style */}
            <div className="flex items-center gap-1">
              {[
                { id: 'solid', label: t('brushStrict'), icon: '▬' },
                { id: 'dashed', label: t('brushCuted'), icon: '╌' },
                { id: 'dotted', label: t('brushPoint'), icon: '●' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBrushType(b.id as any); setIsEraser(false); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider transition-all flex items-center gap-1 ${
                    brushType === b.id && !isEraser
                      ? 'bg-gold/20 text-gold border-gold font-semibold'
                      : 'border-accent-border/40 text-muted-warm hover:border-gold bg-white'
                  }`}
                >
                  <span className="text-[9px] leading-none">{b.icon}</span>
                  {b.label}
                </button>
              ))}
            </div>

            {/* Calligraphy Toggle & Eraser + Clear */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setIsCalligraphy(!isCalligraphy); setIsEraser(false); }}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider transition-colors ${
                  isCalligraphy && !isEraser ? 'bg-gold/20 text-gold border-gold' : 'border-accent-border/40 text-muted-warm hover:border-gold'
                }`}
                title="Calligraphy stroke width variation"
              >
                ✒️ Calligraphy
              </button>
              <button
                onClick={() => setIsEraser(!isEraser)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider transition-colors ${
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
        )}

        {/* Template Tab */}
        {activeCanvasTab === 'template' && (
          <div className="w-full flex items-center gap-2 overflow-x-auto py-1 no-scrollbar animate-fade-in">
            {[
              { id: 'cream', name: 'Cream', style: 'bg-[#fffdf9]' },
              { id: 'gold', name: 'Gold Border', style: 'bg-[#fffdf9] border-2 border-gold/60' },
              { id: 'blush', name: 'Blush Watercolor', style: 'bg-gradient-to-br from-rose-100/40 via-[#fffdf9] to-rose-100/40' },
              { id: 'sage', name: 'Sage Watercolor', style: 'bg-gradient-to-tr from-green-100/30 via-[#fffdf9] to-green-100/30' },
              { id: 'lines', name: 'Notebook Lines', style: 'bg-[#fffdf9] [background-image:linear-gradient(rgba(201,168,76,0.15)_1px,transparent_1px)] [background-size:100%_16px]' }
            ].map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setBgTemplate(tmpl.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 flex-shrink-0 transition-all ${
                  bgTemplate === tmpl.id ? 'border-gold ring-1 ring-gold bg-gold/5 font-semibold' : 'border-accent-border/40 hover:border-gold/50 bg-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-sm border border-accent-border/10 shadow-sm ${tmpl.style}`} />
                {tmpl.name}
              </button>
            ))}
          </div>
        )}

        {/* Stickers Tab */}
        {activeCanvasTab === 'stickers' && (
          <div className="w-full flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-muted-warm/60 mr-1 flex-shrink-0">Stamps:</span>
              {['❤️', '💖', '💍', '🥂', '🎂', '🌸', '🕊️', '✨', '🎈', '💌', '🌹', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addSticker('emoji', emoji)}
                  className="w-8 h-8 rounded-lg bg-blush/30 hover:bg-blush/60 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-muted-warm/60 mr-1 flex-shrink-0">Cursive:</span>
              {(language === 'tr'
                ? ['Tebrikler', 'Sevgiyle', 'Mutluluklar', 'Yeni Evli', 'Sonsuza Dek', 'Şerefe!', 'İyi ki Varsınız']
                : ['Congratulations', 'With Love', 'Best Wishes', 'Just Married', 'Forever & Always', 'Cheers!', 'Thank You']
              ).map((txt) => (
                <button
                  key={txt}
                  onClick={() => addSticker('text', txt)}
                  className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-[11px] font-heading italic text-gold font-semibold border border-gold/20 transition-all hover:scale-[1.03] active:scale-95 whitespace-nowrap"
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Layered Canvas Container */}
      <div
        onClick={() => setSelectedStickerId(null)}
        className={`relative rounded-2xl overflow-hidden border-2 border-dashed border-gold/40 shadow-inner select-none transition-all duration-300 ${
          bgTemplate === 'cream' ? 'bg-[#fffdf9]' :
          bgTemplate === 'gold' ? 'bg-[#fffdf9] border-double border-[6px] border-gold/50' :
          bgTemplate === 'blush' ? 'bg-gradient-to-br from-rose-100/30 via-[#fffdf9] to-rose-100/30' :
          bgTemplate === 'sage' ? 'bg-gradient-to-tr from-green-100/20 via-[#fffdf9] to-green-100/20' :
          'bg-[#fffdf9] [background-image:linear-gradient(rgba(201,168,76,0.08)_1px,transparent_1px)] [background-size:100%_33px]'
        }`}
        style={{ height: 220 }}
      >
        {/* Draw lines on transparent canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          className="absolute inset-0 w-full h-full touch-none z-10"
          style={{ cursor: isEraser ? 'cell' : 'crosshair', display: 'block', background: 'transparent' }}
        />

        {/* Sticker Layer */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {placedStickers.map((st) => {
            const isSelected = selectedStickerId === st.id;
            return (
              <div
                key={st.id}
                style={{
                  position: 'absolute',
                  left: st.x,
                  top: st.y,
                  transform: `translate(-50%, -50%) scale(${st.scale}) rotate(${st.rotation}deg)`,
                  cursor: 'move',
                  touchAction: 'none',
                }}
                className={`absolute p-2 select-none group pointer-events-auto flex items-center justify-center ${
                  isSelected ? 'border border-dashed border-gold/70 bg-white/20 backdrop-blur-[1px] rounded shadow-sm' : 'border border-transparent'
                }`}
                onMouseDown={(e) => startStickerDrag(e, st.id)}
                onTouchStart={(e) => startStickerDrag(e, st.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStickerId(st.id);
                }}
              >
                {st.type === 'text' ? (
                  <span className="font-heading italic text-gold font-semibold text-sm whitespace-nowrap leading-none select-none">{st.value}</span>
                ) : (
                  <span className="text-2xl select-none leading-none select-none">{st.value}</span>
                )}

                {/* Delete Button */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSticker(st.id);
                    }}
                    className="absolute -top-3.5 -right-3.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md border border-white hover:bg-red-600 transition-colors pointer-events-auto"
                  >
                    <X size={10} />
                  </button>
                )}

                {/* Scale & Rotate Handle */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => startStickerTransform(e, st.id)}
                    onTouchStart={(e) => startStickerTransform(e, st.id)}
                    className="absolute -bottom-3.5 -right-3.5 w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center shadow-md border border-white cursor-se-resize hover:bg-gold/80 transition-colors pointer-events-auto"
                  >
                    <RefreshCw size={9} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State Hint */}
        {isEmpty && placedStickers.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
            <PenLine size={28} className="text-gold/25 mb-1" />
            <p className="text-xs text-muted-warm/40 font-medium">{drawHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GuestBook Entry Card ────────────────────────────────────────────────────
const GuestBookCard = memo(function GuestBookCard({ entry, language }: { entry: Upload; language: string }) {
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
            loading="lazy"
          />
        </div>
      )}

      {/* Optional Photo */}
      {(entry.local_url || entry.public_url) && (
        <div className="w-full" style={{ maxHeight: 180, overflow: 'hidden' }}>
          <img
            src={getMediaUrl(entry.local_url || entry.public_url) || undefined}
            alt={entry.caption || 'Guest photo'}
            className="w-full object-cover"
            style={{ maxHeight: 180 }}
            loading="lazy"
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
});

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

  const limit = wedding.max_guestbook_signatures_per_guest ?? 5;
  const currentSentIds = JSON.parse(localStorage.getItem('vv_sent_anonymous_guestbook') || '[]');
  const myGuestBookEntries = uploads.filter((u) => {
    if (u.type !== 'guestbook') return false;
    if (guest && u.guest_id === guest.guest_id) return true;
    return currentSentIds.includes(u.id);
  }).length;
  const isLimitReached = myGuestBookEntries >= limit;

  const canSubmit = !isSubmitting && !isLimitReached && (wishText.trim().length > 0 || !isDrawingEmpty);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
      const guestId = guest?.guest_id || 'anonymous';

      const upload = {
        id: uuidv4(),
        wedding_id: wedding.id,
        guest_id: guestId === 'anonymous' ? null : guestId,
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

      await createUpload(upload, photoFile);

      if (guestId === 'anonymous') {
        const localSent = JSON.parse(localStorage.getItem('vv_sent_anonymous_guestbook') || '[]');
        localSent.push(upload.id);
        localStorage.setItem('vv_sent_anonymous_guestbook', JSON.stringify(localSent));
      }

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

      {/* Explainer card */}
      <div className="mx-5 mb-5 p-4 rounded-2xl bg-white border border-gold/15 shadow-card text-center animate-fade-in">
        <p className="text-xs leading-relaxed text-muted-warm font-medium">
          ✨ {t('guestBookExplainer')}
        </p>
      </div>

      {/* Sign the Book Button */}
      {!showComposer && (
        <div className="px-5 mb-6">
          {isLimitReached ? (
            <div className="w-full p-4 rounded-2xl bg-red-50 border border-red-100 text-center shadow-sm">
              <p className="text-xs font-medium text-red-500">
                ⚠️ {t('guestBookLimitReached', { limit: String(limit) })}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowComposer(true)}
              className="w-full py-4 rounded-full gradient-gold text-white text-sm font-medium flex items-center justify-center gap-2 shadow-elevated hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <PenLine size={18} />
              {t('signGuestBook')}
            </button>
          )}
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
            {isLimitReached && (
              <div className="text-[11px] font-medium text-red-500 bg-red-50 border border-red-100 rounded-xl p-3 leading-relaxed text-center">
                ⚠️ {t('guestBookLimitReached', { limit: String(limit) })}
              </div>
            )}
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
