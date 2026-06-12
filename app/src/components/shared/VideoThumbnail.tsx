import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { getMediaUrl } from '@/lib/mediaHelper';

interface VideoThumbnailProps {
  src: string;
  thumbnailUrl?: string | null;
  className?: string;
  seekTo?: number;
}

/**
 * Renders a highly optimized video thumbnail.
 * If thumbnailUrl exists, it displays it immediately as a static image.
 * If thumbnailUrl does not exist, it shows a clean placeholder with a play icon.
 * Includes a play button overlay to clearly indicate it is a video.
 */
export default function VideoThumbnail({ src, thumbnailUrl, className = '', seekTo: _seekTo = 0.5 }: VideoThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Reset state when source changes
    setIsLoaded(false);
    setFailed(false);
    setInView(false);
  }, [src, thumbnailUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Start loading when 200px away from viewport
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [src, thumbnailUrl]);

  const resolvedThumbUrl = thumbnailUrl ? getMediaUrl(thumbnailUrl) : '';

  return (
    <div
      ref={containerRef}
      className={`relative bg-charcoal/5 overflow-hidden flex items-center justify-center ${className}`}
    >
      {/* Shimmer/Skeleton while loading or off-screen */}
      {!isLoaded && !failed && (
        <div className="absolute inset-0 bg-gradient-to-br from-blush/60 via-accent-border/20 to-blush/40 animate-pulse z-0" />
      )}

      {/* Play Button Overlay (always visible to denote video) */}
      {isLoaded && !failed && (
        <div className="absolute inset-0 bg-black/10 hover:bg-black/25 flex items-center justify-center transition-colors z-10">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/95 backdrop-blur-sm shadow-premium flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
            <Play className="w-4 h-4 md:w-5 md:h-5 text-gold fill-gold ml-0.5" />
          </div>
        </div>
      )}

      {/* Static image thumbnail if available */}
      {resolvedThumbUrl && inView ? (
        <img
          src={resolvedThumbUrl}
          alt="Video thumbnail"
          onLoad={() => setIsLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ display: failed ? 'none' : 'block' }}
        />
      ) : null}

      {/* Fallback Placeholder (if no thumbnail exists or image load failed) */}
      {(!resolvedThumbUrl || failed) && inView ? (
        <div 
          className="absolute inset-0 bg-gradient-to-br from-charcoal/70 via-gold/15 to-blush/30 flex flex-col items-center justify-center p-4 text-center"
          ref={() => {
            // Instantly mark as loaded since it's a CSS template
            if (!isLoaded) {
              setTimeout(() => setIsLoaded(true), 0);
            }
          }}
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-elevated mb-2">
            <Play size={24} className="text-white fill-white ml-0.5" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/85 font-semibold">Play Video</span>
        </div>
      ) : null}
    </div>
  );
}
