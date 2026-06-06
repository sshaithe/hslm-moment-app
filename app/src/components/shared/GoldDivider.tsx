interface GoldDividerProps {
  className?: string;
  width?: string;
}

export default function GoldDivider({ className = '', width = 'w-10' }: GoldDividerProps) {
  return (
    <div className={`h-px ${width} bg-gold-light mx-auto ${className}`} />
  );
}
