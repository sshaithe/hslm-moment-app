import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Download, Flag, Send } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import ReactionBar from '@/components/shared/ReactionBar';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import EmojiPicker from '@/components/shared/EmojiPicker';
import { getMediaUrl } from '@/lib/mediaHelper';

export default function PhotoDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wedding, currentGuest: guest, uploads, comments: allComments, submitComment, modifyUpload } = useDatabase();
  const { t, language } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const upload = uploads.find((u) => u.id === id);

  if (!upload) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <p className="text-muted-warm">{t('memoryNotFound')}</p>
      </div>
    );
  }

  const comments = allComments.filter((c) => c.upload_id === upload.id);
  const guestId = guest?.guest_id || 'anonymous';

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    if (!wedding.allow_comments) {
      addToast(t('commentsDisabled'), 'error');
      return;
    }

    const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
    await submitComment(upload.id, guestId, guestName, commentText.trim());
    setCommentText('');
  };

  const handleReport = async () => {
    const newCount = (upload.report_count || 0) + 1;
    await modifyUpload(upload.id, { report_count: newCount });

    if (wedding.auto_hide_reported && newCount >= 3) {
      await modifyUpload(upload.id, { is_hidden: true });
    }

    addToast(t('actionSuccess'), 'success');
    setShowReportConfirm(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col animate-fade-in">
      {/* Image/Video */}
      <div className="relative bg-charcoal">
        {upload.type === 'video' ? (
          <video
            src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
            className="w-full max-h-[60vh] object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : upload.type === 'photo' ? (
          <img
            src={getMediaUrl(upload.local_url || upload.public_url) || undefined}
            alt={upload.caption || ''}
            className="w-full max-h-[60vh] object-contain"
          />
        ) : (
          <div className="w-full h-48 bg-blush flex items-center justify-center">
            <span className="font-heading italic text-2xl text-charcoal">&ldquo;{upload.message_text?.slice(0, 50)}...&rdquo;</span>
          </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/40 to-transparent">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-charcoal/40 backdrop-blur-sm flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
          {wedding.allow_downloads && upload.type !== 'message' && (
            <button className="w-9 h-9 rounded-full bg-charcoal/40 backdrop-blur-sm flex items-center justify-center">
              <Download size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Detail Card */}
      <div className="flex-1 bg-ivory rounded-t-3xl -mt-6 relative z-10 px-5 pt-6">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {upload.guest_name.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-charcoal">{upload.guest_name}</p>
            <p className="text-xs text-muted-warm">{formatTime(upload.created_at)}</p>
          </div>
        </div>

        {/* Caption */}
        {upload.caption && (
          <p className="text-sm text-charcoal leading-relaxed mb-4">{upload.caption}</p>
        )}
        {upload.message_text && upload.type === 'message' && (
          <p className="font-heading italic text-base text-charcoal leading-relaxed mb-4">
            &ldquo;{upload.message_text}&rdquo;
          </p>
        )}

        {/* Reactions */}
        <div className="mb-6">
          <ReactionBar uploadId={upload.id} guestId={guestId} />
        </div>

        {/* Comments */}
        {wedding.allow_comments && (
          <div className="border-t border-accent-border/30 pt-4">
            <h4 className="text-sm font-medium text-charcoal mb-3">
              {t('commentsCount')} ({comments.length})
            </h4>

            {comments.length === 0 ? (
              <p className="text-xs text-muted-warm/60 mb-4">
                {t('beFirstComment')}
              </p>
            ) : (
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto no-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blush flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-medium text-charcoal">
                        {comment.guest_name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-blush/50 rounded-xl rounded-tl-sm px-3 py-2">
                        <p className="text-xs font-medium text-charcoal">{comment.guest_name}</p>
                        <p className="text-xs text-charcoal/80 mt-0.5">{comment.text}</p>
                      </div>
                      <p className="text-[10px] text-muted-warm/50 mt-0.5 ml-1">{formatTime(comment.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment Input */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-blush/50 rounded-full px-4 py-2.5 gap-1">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('addComment')}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none"
                />
                <EmojiPicker onSelect={(emoji) => setCommentText((prev) => prev + emoji)} />
              </div>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center disabled:opacity-30"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Report */}
        <div className="mt-6 pt-4 border-t border-accent-border/20 pb-6">
          {!showReportConfirm ? (
            <button
              onClick={() => setShowReportConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-muted-warm/50 hover:text-red-400 transition-colors"
            >
              <Flag size={12} />
              <span>{t('report')}</span>
            </button>
          ) : (
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-red-600 mb-2">{t('reportConfirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleReport}
                  className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-medium"
                >
                  {t('report')}
                </button>
                <button
                  onClick={() => setShowReportConfirm(false)}
                  className="px-3 py-1.5 rounded-full bg-white text-charcoal text-xs font-medium border border-accent-border"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
