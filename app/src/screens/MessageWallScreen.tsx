import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, PenLine, Video, Quote, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import GoldDivider from '@/components/shared/GoldDivider';
import type { Upload } from '@/lib/types';
import EmojiPicker from '@/components/shared/EmojiPicker';

export default function MessageWallScreen() {
  const navigate = useNavigate();
  const { wedding, currentGuest: guest, uploads, createUpload, reactions, refreshUploads, refreshReactions, isSupabase } = useDatabase();
  const { t, language } = useLanguage();
  const [showComposer, setShowComposer] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('vv_message_wall_text');
    if (saved) {
      setMessageText(saved);
      setShowComposer(true);
    }
  }, []);

  const handleMessageChange = (val: string) => {
    setMessageText(val);
    localStorage.setItem('vv_message_wall_text', val);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshUploads(), refreshReactions()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Visibility-aware 5-minute polling + cleanup
  useEffect(() => {
    if (!isSupabase) return;

    // Load reactions for the popular messages
    handleRefresh();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUploads();
        refreshReactions();
        setLastUpdated(new Date());
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isSupabase]);
  const messages = uploads.filter((u) => u.type === 'message' && !u.is_hidden && (!wedding.approve_before_display || u.is_approved));

  const handleSubmit = async () => {
    if (!messageText.trim()) return;

    const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
    const guestId = guest?.guest_id || 'anonymous';

    try {
      await createUpload({
        id: uuidv4(),
        wedding_id: wedding.id,
        guest_id: guestId,
        guest_name: guestName,
        type: 'message',
        message_text: messageText.trim(),
        is_approved: !wedding.approve_before_display,
        is_hidden: false,
        is_featured: false,
        report_count: 0,
      });

      setMessageText('');
      localStorage.removeItem('vv_message_wall_text');
      setShowComposer(false);
    } catch (err) {
      console.error('Failed to submit message:', err);
      alert(t('uploadFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-ivory pb-20">
      {/* Header */}
      <div className="text-center pt-6 pb-4 px-6 relative">
        {isSupabase && (
          <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] text-muted-warm font-medium">
            <span>Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50 flex items-center justify-center"
              title="Refresh messages"
            >
              <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gold mb-2">{t('weddingWishes')}</p>
        <h1 className="font-heading text-3xl text-charcoal italic">{t('memoryWall')}</h1>
        <GoldDivider width="w-12" className="my-3" />
        <p className="text-sm text-muted-warm">{messages.length} {language === 'tr' ? 'dilek' : 'wishes'}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 px-5 mb-6">
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="flex-1 py-3 rounded-full gradient-gold text-white text-sm font-medium flex items-center justify-center gap-2 shadow-elevated"
        >
          <PenLine size={16} />
          {t('writeMessage')}
        </button>
        <button
          onClick={() => navigate('/upload')}
          className="flex-1 py-3 rounded-full bg-charcoal text-ivory text-sm font-medium flex items-center justify-center gap-2"
        >
          <Video size={16} />
          {t('videoWish')}
        </button>
      </div>

      {/* Inline Composer */}
      {showComposer && (
        <div className="mx-5 mb-6 bg-white rounded-2xl p-4 shadow-card animate-slide-up">
          <textarea
            value={messageText}
            onChange={(e) => handleMessageChange(e.target.value)}
            placeholder={t('writeWishes')}
            rows={4}
            className="w-full bg-blush/30 rounded-xl p-3 text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <EmojiPicker onSelect={(emoji) => handleMessageChange(messageText + emoji)} />
            <div className="flex gap-2">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 rounded-full text-xs text-muted-warm hover:bg-blush transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!messageText.trim()}
                className="px-5 py-2 rounded-full gradient-gold text-white text-xs font-medium disabled:opacity-30"
              >
                {t('shareNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="px-5 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <Quote size={32} className="mx-auto text-gold/30 mb-3" />
            <p className="font-heading italic text-muted-warm text-sm">
              {t('noWishes')}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageCard key={msg.id} msg={msg} reactions={reactions} language={language} />
          ))
        )}
      </div>
    </div>
  );
}

function MessageCard({ msg, reactions, language }: { msg: Upload; reactions: { upload_id: string; type: string }[]; language: string }) {
  const heartCount = reactions.filter((r) => r.upload_id === msg.id && r.type === 'heart').length;

  return (
    <div className="bg-white rounded-2xl p-5 relative overflow-hidden shadow-card">
      <Quote size={28} className="absolute top-3 right-4 text-gold/15" />
      <p className="font-heading italic text-base text-charcoal leading-relaxed relative z-10 mb-4">
        &ldquo;{msg.message_text}&rdquo;
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-charcoal">{msg.guest_name}</p>
          <p className="text-xs text-muted-warm">
            {new Date(msg.created_at).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blush/50 text-muted-warm text-xs">
          <Heart size={14} />
          <span>{heartCount}</span>
        </button>
      </div>
    </div>
  );
}
