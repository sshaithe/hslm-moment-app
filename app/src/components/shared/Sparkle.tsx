import { useEffect, useState } from 'react';

interface SparkleProps {
  x: number;
  y: number;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  duration: number;
  filled: boolean;
}

export default function Sparkle({ x, y, onComplete }: SparkleProps) {
  const [particles] = useState<Particle[]>(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i * 30) + (Math.random() * 20 - 10),
      distance: 30 + Math.random() * 40,
      size: 3 + Math.random() * 3,
      duration: 0.5 + Math.random() * 0.3,
      filled: i % 2 === 0,
    }));
  });

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" style={{ left: x - 100, top: y - 100, width: 200, height: 200 }}>
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.distance;
        const ty = Math.sin(rad) * p.distance;
        return (
          <div
            key={p.id}
            className="absolute left-1/2 top-1/2 rounded-full animate-sparkle"
            style={
              {
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                width: p.size,
                height: p.size,
                backgroundColor: p.filled ? '#B8975A' : 'transparent',
                border: p.filled ? 'none' : '1px solid #D4AF6E',
                animationDuration: `${p.duration}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
