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
  const { wedding, currentGuest: guest, uploads, comments: allComments, submitComment, modifyUpload, registerGuest } = useDatabase();
  const { t, language } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const nameRegex = /^[a-zA-ZçğıöşüÇĞİÖŞÜ\s'\-]+$/;

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

    if (!guest) {
      setShowRegisterModal(true);
      return;
    }

    const guestName = `${guest.first_name} ${guest.last_name}`;
    await submitComment(upload.id, guest.guest_id, guestName, commentText.trim());
    setCommentText('');
  };

  const handleRegisterAndComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim() || !regLastName.trim() || errors.firstName || errors.lastName) return;

    try {
      setIsRegistering(true);
      const newGuest = await registerGuest(regFirstName.trim(), regLastName.trim());
      
      const guestName = `${newGuest.first_name} ${newGuest.last_name}`;
      await submitComment(upload.id, newGuest.id, guestName, commentText.trim());
      
      setCommentText('');
      setShowRegisterModal(false);
      setRegFirstName('');
      setRegLastName('');
      addToast(t('actionSuccess'), 'success');
    } catch (err) {
      console.error('Registration failed:', err);
      addToast(language === 'tr' ? 'Kayıt sırasında bir hata oluştu' : 'Failed to register', 'error');
    } finally {
      setIsRegistering(false);
    }
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

      {/* Registration Modal for Unregistered Guests commenting */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => {
          setShowRegisterModal(false);
          setRegFirstName('');
          setRegLastName('');
          setErrors({});
        }}>
          <div 
            className="bg-white rounded-3xl w-full max-w-[380px] p-6 shadow-premium border border-accent-border/30 relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowRegisterModal(false);
                setRegFirstName('');
                setRegLastName('');
                setErrors({});
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-blush flex items-center justify-center text-muted-warm hover:text-charcoal transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="font-heading text-xl text-charcoal text-center mb-2">
              {language === 'tr' ? 'Yorum Yapmak İçin Katılın' : 'Join to Comment'}
            </h3>
            <p className="text-xs text-muted-warm text-center mb-6 leading-relaxed">
              {language === 'tr' 
                ? 'Lütfen isminizi girin. Bu isim yorumunuzun yanında görüntülenecektir.' 
                : 'Please enter your name. This name will appear next to your comment.'}
            </p>

            <form onSubmit={handleRegisterAndComment} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm/80 block mb-1">
                  {t('firstName')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('firstName')}
                  value={regFirstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRegFirstName(val);
                    setErrors((p) => ({
                      ...p,
                      firstName: val.trim() === '' || !nameRegex.test(val.trim())
                    }));
                  }}
                  className={`w-full bg-blush/30 border rounded-xl px-4 py-2.5 text-sm text-charcoal placeholder:text-muted-warm/40 focus:outline-none transition-colors ${
                    errors.firstName ? 'border-red-400 focus:border-red-400' : 'border-accent-border/40 focus:border-gold'
                  }`}
                />
                {errors.firstName && (
                  <p className="text-[10px] text-red-400 mt-1">{t('invalidNameError')}</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-warm/80 block mb-1">
                  {t('lastName')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('lastName')}
                  value={regLastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRegLastName(val);
                    setErrors((p) => ({
                      ...p,
                      lastName: val.trim() === '' || !nameRegex.test(val.trim())
                    }));
                  }}
                  className={`w-full bg-blush/30 border rounded-xl px-4 py-2.5 text-sm text-charcoal placeholder:text-muted-warm/40 focus:outline-none transition-colors ${
                    errors.lastName ? 'border-red-400 focus:border-red-400' : 'border-accent-border/40 focus:border-gold'
                  }`}
                />
                {errors.lastName && (
                  <p className="text-[10px] text-red-400 mt-1">{t('invalidNameError')}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isRegistering || !regFirstName.trim() || !regLastName.trim() || errors.firstName || errors.lastName}
                className="w-full py-3 rounded-full gradient-gold text-white text-sm font-semibold shadow-elevated hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2"
              >
                {isRegistering 
                  ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') 
                  : (language === 'tr' ? 'Katıl ve Gönder' : 'Join & Send')}
              </button>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
