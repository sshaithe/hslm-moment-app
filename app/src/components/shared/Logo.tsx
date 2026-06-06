import { Lock } from 'lucide-react';

interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ variant = 'dark', size = 'md', showText = true }: LogoProps) {
  const isLight = variant === 'light';
  const sizes = {
    sm: { icon: 16, text: 'text-sm' },
    md: { icon: 20, text: 'text-lg' },
    lg: { icon: 28, text: 'text-2xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-1.5">
      <Lock
        size={s.icon}
        className={isLight ? 'text-gold-light' : 'text-gold'}
        strokeWidth={1.5}
      />
      {showText && (
        <span className={`font-heading font-medium ${s.text} tracking-tight ${isLight ? 'text-ivory' : 'text-charcoal'}`}>
          HSLM Moment
        </span>
      )}
    </div>
  );
}
