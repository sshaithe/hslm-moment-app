import { useEffect, useRef, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  className?: string;
  /** How many seconds into the video to capture the frame. Default: 0.5 */
  seekTo?: number;
}

/**
 * Renders a lazy-loaded video thumbnail using native HTML5 media fragments (#t=0.5).
 * Uses an IntersectionObserver to defer loading until the component is close to the viewport,
 * bypassing connection queue clogging and CORS security restrictions on canvas capture.
 */
export default function VideoThumbnail({ src, className = '', seekTo = 0.5 }: VideoThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Append time fragment to force loading and seeking to that frame
  // e.g. https://domain.com/video.mp4#t=0.5
  const videoSrc = src ? `${src}#t=${seekTo}` : '';

  useEffect(() => {
    // Reset state when source changes
    setIsLoaded(false);
    setFailed(false);
    setInView(false);
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect(); // Only trigger load once
          }
        });
      },
      {
        rootMargin: '200px', // Start loading when 200px away from viewport
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-charcoal/5 overflow-hidden ${className}`}
    >
      {/* Shimmer/Skeleton while loading or off-screen */}
      {(!isLoaded || !inView) && !failed && (
        <div className="absolute inset-0 bg-gradient-to-br from-blush/60 via-accent-border/20 to-blush/40 animate-pulse" />
      )}

      {videoSrc && inView ? (
        <video
          ref={videoRef}
          src={videoSrc}
          preload="metadata"
          playsInline
          muted
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ display: failed ? 'none' : 'block' }}
        />
      ) : null}

      {/* Fallback if load fails */}
      {failed && (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal/10 via-gold/10 to-blush/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-charcoal/30">
            <polygon points="5,3 19,12 5,21" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}
