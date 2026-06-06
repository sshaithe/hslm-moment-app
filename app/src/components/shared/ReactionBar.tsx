import { Heart, Laugh, Zap } from 'lucide-react';
import { getReactionCounts, hasReacted, addReaction, removeReaction } from '@/lib/localStore';
import type { Reaction } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface ReactionBarProps {
  uploadId: string;
  guestId: string;
  onReact?: () => void;
  compact?: boolean;
}

export default function ReactionBar({ uploadId, guestId, onReact, compact = false }: ReactionBarProps) {
  const counts = getReactionCounts(uploadId);

  const handleReact = (type: Reaction['type']) => {
    if (hasReacted(uploadId, guestId, type)) {
      removeReaction(uploadId, guestId, type);
    } else {
      const reaction: Reaction = {
        id: uuidv4(),
        upload_id: uploadId,
        guest_id: guestId,
        type,
        created_at: new Date().toISOString(),
      };
      addReaction(reaction);
    }
    onReact?.();
  };

  const size = compact ? 14 : 18;
  const btnClass = compact
    ? 'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all'
    : 'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleReact('heart')}
        className={`${btnClass} ${
          hasReacted(uploadId, guestId, 'heart')
            ? 'bg-red-50 text-red-500'
            : 'bg-blush/50 text-muted-warm hover:bg-blush'
        }`}
      >
        <Heart size={size} fill={hasReacted(uploadId, guestId, 'heart') ? 'currentColor' : 'none'} />
        <span>{counts.heart}</span>
      </button>

      <button
        onClick={() => handleReact('laugh')}
        className={`${btnClass} ${
          hasReacted(uploadId, guestId, 'laugh')
            ? 'bg-amber-50 text-amber-500'
            : 'bg-blush/50 text-muted-warm hover:bg-blush'
        }`}
      >
        <Laugh size={size} />
        <span>{counts.laugh}</span>
      </button>

      <button
        onClick={() => handleReact('wow')}
        className={`${btnClass} ${
          hasReacted(uploadId, guestId, 'wow')
            ? 'bg-purple-50 text-purple-500'
            : 'bg-blush/50 text-muted-warm hover:bg-blush'
        }`}
      >
        <Zap size={size} />
        <span>{counts.wow}</span>
      </button>
    </div>
  );
}
