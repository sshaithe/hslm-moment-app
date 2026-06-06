import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Pause, X } from 'lucide-react';
import { getWedding, getUploads } from '@/lib/localStore';
import Logo from '@/components/shared/Logo';
import { useLanguage } from '@/i18n/LanguageContext';

export default function SlideshowScreen() {
  const navigate = useNavigate();
  const wedding = getWedding();
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [fadeKey, setFadeKey] = useState(0);

  const allUploads = getUploads();
  const visibleUploads = allUploads.filter((u) => {
    if (u.is_hidden) return false;
    if (u.type === 'message') return false;
    if (wedding.slideshow_approval_mode && !u.is_approved && !u.is_featured) return false;
    return true;
  });

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % visibleUploads.length);
    setFadeKey((k) => k + 1);
  }, [visibleUploads.length]);

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + visibleUploads.length) % visibleUploads.length);
    setFadeKey((k) => k + 1);
  };

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || visibleUploads.length === 0) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, goNext, visibleUploads.length]);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls, currentIndex]);

  if (visibleUploads.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0806] flex items-center justify-center" onClick={() => setShowControls(true)}>
        <p className="text-white/40 font-heading italic">{t('noPhotos')}</p>
      </div>
    );
  }

  const current = visibleUploads[currentIndex];

  return (
    <div
      className="fixed inset-0 bg-[#0A0806] z-[60] cursor-pointer"
      onClick={() => setShowControls(true)}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Image */}
      <div key={fadeKey} className="absolute inset-0 animate-fade-in">
        <img
          src={current.local_url || current.public_url}
          alt=""
          className="w-full h-full object-contain"
        />
      </div>

      {/* Top Overlay */}
      <div className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="light" size="sm" />
            <span className="font-heading text-white/80 italic text-lg">{wedding.couple_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-live" />
            <span className="text-xs font-semibold text-green-400 tracking-wider">{t('liveGalleryUpper')}</span>
          </div>
        </div>
      </div>

      {/* Bottom Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {current.caption && (
          <p className="font-heading italic text-white/90 text-lg mb-2">{current.caption}</p>
        )}
        <p className="text-sm text-white/60">{current.guest_name}</p>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {visibleUploads.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); setFadeKey((k) => k + 1); }}
              className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-6 bg-gold' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>

        {/* Counter */}
        <p className="text-center text-xs text-white/40 mt-2">
          {currentIndex + 1} / {visibleUploads.length}
        </p>
      </div>

      {/* Controls */}
      <div className={`absolute inset-0 flex items-center justify-between px-4 transition-opacity duration-500 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto hover:bg-black/50 transition-colors"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto hover:bg-black/50 transition-colors"
        >
          <ChevronRight size={24} className="text-white" />
        </button>
      </div>

      {/* Play/Pause & Close */}
      <div className={`absolute bottom-8 right-8 flex items-center gap-3 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate('/admin/dashboard'); }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <X size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
