import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: '❤️',
    emojis: ['❤️', '🥰', '😍', '💕', '💖', '💗', '💓', '💞', '💝', '💘', '🫶', '👫', '💑', '👰', '🤵', '💍', '🎊', '🎉', '✨', '🌹'],
  },
  {
    label: '😊',
    emojis: ['😊', '😁', '😄', '😂', '🥹', '😭', '🥲', '🤩', '😎', '🤗', '😘', '🫠', '😋', '😜', '🤣', '🙂', '😇', '🫡', '🥳', '🤩'],
  },
  {
    label: '🎵',
    emojis: ['🎵', '🎶', '🎸', '🥂', '🍾', '🎂', '🎁', '🌸', '🌺', '🌻', '💐', '🕯️', '🪄', '🌙', '⭐', '🌟', '💫', '🎈', '🎀', '📸'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  align?: 'left' | 'right';
}

export default function EmojiPicker({ onSelect, align = 'right' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-muted-warm hover:bg-blush hover:text-gold transition-colors"
        aria-label="Emoji picker"
      >
        <Smile size={18} />
      </button>

      {open && (
        <div className={`absolute bottom-10 ${align === 'left' ? 'left-0' : 'right-0'} z-50 bg-white rounded-2xl shadow-elevated border border-accent-border/30 p-3 w-64 animate-fade-in`}>
          {/* Group tabs */}
          <div className="flex gap-1 mb-2 border-b border-accent-border/20 pb-2">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={`flex-1 py-1 rounded-lg text-lg transition-colors ${
                  activeGroup === i ? 'bg-blush' : 'hover:bg-blush/40'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-5 gap-0.5">
            {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="text-xl p-1.5 rounded-lg hover:bg-blush/60 transition-colors leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
