import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, QrCode, Monitor, Pause, Play, Image, MessageSquare, Users, Clock, Eye, EyeOff, CheckCircle, Star, Trash2, RefreshCw, BookOpen } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Upload } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';
import VideoThumbnail from '@/components/shared/VideoThumbnail';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { wedding, uploads, guests, saveWeddingSettings, modifyUpload, removeUpload, refreshWeddingSettings, refreshUploads, refreshGuests, isSupabase } = useDatabase();
  const { t, language } = useLanguage();
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshWeddingSettings(), refreshUploads(), refreshGuests()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Visibility-aware dynamic polling + cleanup
  useEffect(() => {
    if (!isSupabase) return;

    // Load initial data on dashboard mount (e.g., guests isn't loaded in Provider first load)
    handleRefresh();

    const intervalTime = isAutoRefresh ? 5000 : 2 * 60 * 1000;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshWeddingSettings();
        refreshUploads();
        refreshGuests();
        setLastUpdated(new Date());
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isSupabase, isAutoRefresh]);

  const handleDownloadAll = async () => {
    if (downloadProgress) return; // Prevent double execution

    const mediaUploads = uploads.filter((u) => u.type === 'photo' || u.type === 'video');
    if (mediaUploads.length === 0) {
      alert(t('noPhotos') || 'No photos or videos to download.');
      return;
    }

    try {
      setDownloadProgress('0%');
      let JSZipModule;
      try {
        JSZipModule = await import('jszip');
      } catch (importErr) {
        console.error('Failed to dynamically import jszip. Reloading to get new chunks...', importErr);
        window.location.reload();
        return;
      }
      const JSZip = JSZipModule.default;
      const zip = new JSZip();

      let loadedCount = 0;
      for (const upload of mediaUploads) {
        const url = upload.public_url || upload.local_url;
        if (!url) {
          loadedCount++;
          continue;
        }

        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const blob = await res.blob();

          const sanitizedName = upload.guest_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const extension = upload.type === 'video' ? 'mp4' : 'jpg';
          const fileIndex = mediaUploads.indexOf(upload) + 1;
          const fileName = `${fileIndex}_${sanitizedName}_${upload.id.slice(0, 8)}.${extension}`;
          
          zip.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to fetch media from ${url}:`, err);
        }

        loadedCount++;
        const percent = Math.round((loadedCount / mediaUploads.length) * 100);
        setDownloadProgress(`${percent}%`);
      }

      setDownloadProgress('Zipping...');
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        if (metadata.percent) {
          setDownloadProgress(`Zipping (${Math.round(metadata.percent)}%)`);
        }
      });

      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const coupleName = wedding.couple_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      link.download = `${coupleName}_wedding_media.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download all media:', error);
      alert(t('error') || 'Failed to download and package media files.');
    } finally {
      setDownloadProgress(null);
    }
  };

  // ─── PDF Guest Book Export ───────────────────────────────────────────────
  const handleDownloadGuestBookPdf = async () => {
    if (pdfProgress) return;

    const guestbookEntries = uploads.filter((u) => u.type === 'guestbook');
    if (guestbookEntries.length === 0) {
      alert(t('guestBookPdfEmpty'));
      return;
    }

    try {
      setPdfProgress('Loading...');
      let jsPDFModule;
      try {
        jsPDFModule = await import('jspdf');
      } catch (importErr) {
        console.error('Failed to dynamically import jspdf. Reloading to get new chunks...', importErr);
        window.location.reload();
        return;
      }
      const { jsPDF } = jsPDFModule;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;

      // Helper to load image from URL as base64
      const loadImage = (src: string): Promise<string | null> =>
        new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = () => resolve(null);
          img.src = src;
        });

      // ── Cover Page ──────────────────────────────────────────────────────────
      // Background gradient simulation using a filled rect
      doc.setFillColor(255, 251, 245); // ivory
      doc.rect(0, 0, pageW, pageH, 'F');

      // Gold accent line top
      doc.setFillColor(201, 168, 76);
      doc.rect(0, 0, pageW, 3, 'F');
      doc.rect(0, pageH - 3, pageW, 3, 'F');

      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(180, 150, 80);
      doc.text(t('pdfKeepsakeFrom'), pageW / 2, 35, { align: 'center' });

      doc.setFont('times', 'bolditalic');
      doc.setFontSize(30);
      doc.setTextColor(40, 35, 30);
      doc.text(wedding.couple_name, pageW / 2, 52, { align: 'center' });

      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(120, 100, 80);
      const formattedDate = new Date(wedding.wedding_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      doc.text(formattedDate, pageW / 2, 63, { align: 'center' });
      doc.text(wedding.venue, pageW / 2, 71, { align: 'center' });

      // Decorative divider
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.5);
      doc.line(margin + 20, 79, pageW - margin - 20, 79);

      doc.setFont('times', 'bolditalic');
      doc.setFontSize(24);
      doc.setTextColor(40, 35, 30);
      doc.text('Guest Book', pageW / 2, 96, { align: 'center' });

      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(150, 130, 110);
      doc.text(t('pdfHeartfeltEntries', { count: String(guestbookEntries.length) }), pageW / 2, 108, { align: 'center' });

      // ── Entry Pages ──────────────────────────────────────────────────────────
      let entryNum = 0;
      for (const entry of guestbookEntries) {
        entryNum++;
        setPdfProgress(`${Math.round((entryNum / guestbookEntries.length) * 100)}%`);
        doc.addPage();

        // Page background
        doc.setFillColor(255, 251, 245);
        doc.rect(0, 0, pageW, pageH, 'F');

        // Gold top bar
        doc.setFillColor(201, 168, 76);
        doc.rect(0, 0, pageW, 2, 'F');

        let yPos = margin;

        // Guest name header
        doc.setFont('times', 'bolditalic');
        doc.setFontSize(18);
        doc.setTextColor(40, 35, 30);
        doc.text(entry.guest_name, margin, yPos + 6);
        yPos += 10;

        // Date
        const entryDate = new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric'
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(150, 130, 110);
        doc.text(entryDate, margin, yPos + 2);
        yPos += 8;

        // Gold divider
        doc.setDrawColor(201, 168, 76);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 8;

        // Drawing image
        if (entry.drawing_data_url) {
          try {
            const drawH = 50;
            doc.addImage(entry.drawing_data_url, 'PNG', margin, yPos, contentW, drawH);
            yPos += drawH + 6;
          } catch { /* skip if invalid */ }
        }

        // Wish text
        if (entry.message_text) {
          doc.setFont('times', 'italic');
          doc.setFontSize(13);
          doc.setTextColor(60, 50, 40);
          const lines = doc.splitTextToSize(`\u201C${entry.message_text}\u201D`, contentW);
          doc.text(lines, margin, yPos);
          yPos += lines.length * 7 + 6;
        }

        // Photo image
        const photoSrc = entry.public_url || entry.local_url;
        if (photoSrc && !photoSrc.startsWith('blob:')) {
          const b64 = await loadImage(photoSrc);
          if (b64) {
            const maxImgH = Math.min(80, pageH - yPos - margin);
            const maxImgW = contentW;
            try {
              doc.addImage(b64, 'JPEG', margin, yPos, maxImgW, maxImgH);
              yPos += maxImgH + 4;
            } catch { /* skip */ }
          }
        }

        // Page number
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 160, 130);
        doc.text(`${entryNum} / ${guestbookEntries.length}`, pageW - margin, pageH - 10, { align: 'right' });
      }

      // Save
      const safeName = wedding.couple_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      doc.save(`${safeName}_guest_book.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert(t('guestBookPdfError'));
    } finally {
      setPdfProgress(null);
    }
  };

  const stats = [
    { label: t('totalUploadsStat'), value: uploads.length, icon: Image, color: 'bg-gold/10 text-gold' },
    { label: t('guestMessages'), value: uploads.filter((u) => u.type === 'message').length, icon: MessageSquare, color: 'bg-blush text-gold' },
    { label: t('pendingApproval'), value: uploads.filter((u) => !u.is_approved && !u.is_hidden).length, icon: Clock, color: 'bg-amber-50 text-amber-500' },
    { label: t('activeGuestsStat'), value: guests.length, icon: Users, color: 'bg-green-50 text-green-600' },
  ];

  const quickActions = [
    {
      label: downloadProgress ? `${t('downloadAll')} (${downloadProgress})` : t('downloadAll'),
      icon: Download,
      action: handleDownloadAll
    },
    { label: t('generateQR'), icon: QrCode, action: () => navigate('/admin/qr') },
    { label: t('liveSlideshow'), icon: Monitor, action: () => navigate('/admin/slideshow') },
    {
      label: wedding.uploads_paused ? t('resumeUploads') : t('pauseUploads'),
      icon: wedding.uploads_paused ? Play : Pause,
      action: () => {
        saveWeddingSettings({ uploads_paused: !wedding.uploads_paused });
      },
    },
    {
      label: pdfProgress ? `${t('guestBookPdf')} (${pdfProgress})` : t('guestBookPdf'),
      icon: BookOpen,
      action: handleDownloadGuestBookPdf,
    },
  ];

  const recentUploads = uploads
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const handleAction = async (upload: Upload, action: string) => {
    switch (action) {
      case 'hide':
        await modifyUpload(upload.id, { is_hidden: true });
        break;
      case 'unhide':
        await modifyUpload(upload.id, { is_hidden: false });
        break;
      case 'approve':
        await modifyUpload(upload.id, { is_approved: true });
        break;
      case 'feature':
        await modifyUpload(upload.id, { is_featured: !upload.is_featured });
        break;
      case 'delete':
        await removeUpload(upload.id);
        break;
    }
  };

  const getStatusBadge = (upload: Upload) => {
    if (upload.is_hidden) return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-medium">{t('hidden')}</span>;
    if (!upload.is_approved) return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium">{t('pending')}</span>;
    if (upload.is_featured) return <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] font-medium">{t('featured')}</span>;
    return <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-medium">{t('visible')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl text-charcoal">{wedding.couple_name} &mdash; {t('weddingDashboard')}</h1>
          <p className="text-sm text-muted-warm mt-1">{new Date(wedding.wedding_date).toLocaleDateString()} &bull; {wedding.venue}</p>
        </div>
        {isSupabase && (
          <div className="flex items-center gap-4 self-start sm:self-center text-xs text-muted-warm font-medium bg-white px-3 py-1.5 rounded-xl shadow-card border border-accent-border/10">
            {/* Auto-Refresh Toggle */}
            <div className="flex items-center gap-2 border-r border-accent-border/20 pr-3">
              <span>{language === 'tr' ? 'Otomatik Yenile' : 'Auto-Refresh'}</span>
              <button
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none ${isAutoRefresh ? 'bg-gold' : 'bg-accent-border'}`}
                title={language === 'tr' ? 'Otomatik Yenileme: 5 saniye' : 'Auto-Refresh: 5 seconds'}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 left-0.5 transition-transform ${isAutoRefresh ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                title="Refresh dashboard"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-card">
            <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={18} />
            </div>
            <p className="text-2xl font-semibold text-charcoal">{stat.value}</p>
            <p className="text-xs text-muted-warm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={action.action}
            className="bg-white rounded-xl p-4 shadow-card hover:shadow-elevated transition-shadow text-left"
          >
            <action.icon size={20} className="text-gold mb-2" />
            <p className="text-sm font-medium text-charcoal">{action.label}</p>
          </button>
        ))}
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-xl p-5 shadow-card">
        <h3 className="font-medium text-charcoal mb-4">{t('settings')}</h3>
        <div className="space-y-3">
          {[
            { key: 'is_public', label: t('publicGallery') },
            { key: 'slideshow_approval_mode', label: t('slideshowApproval') },
            { key: 'allow_comments', label: t('guestComments') },
            { key: 'allow_downloads', label: t('allowGuestDownloads') },
          ].map((toggle) => {
            const key = toggle.key as keyof typeof wedding;
            const value = wedding[key] as boolean;
            return (
              <div key={toggle.key} className="flex items-center justify-between py-2 border-b border-accent-border/20 last:border-0">
                <span className="text-sm text-charcoal">{toggle.label}</span>
                <button
                  onClick={() => {
                    saveWeddingSettings({ [key]: !value });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-gold' : 'bg-accent-border'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-accent-border/20">
          <h3 className="font-medium text-charcoal">{t('uploadsManagement')}</h3>
        </div>
        <div className="divide-y divide-accent-border/20">
          {recentUploads.map((upload) => (
            <div key={upload.id} className="flex items-center gap-3 p-4 hover:bg-ivory/50 transition-colors">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-blush flex-shrink-0">
                {upload.type === 'video' ? (
                  <VideoThumbnail
                    src={getMediaUrl(upload.local_url || upload.public_url) || ''}
                    className="w-full h-full"
                    seekTo={0.5}
                  />
                ) : upload.type === 'photo' ? (
                  <img src={getMediaUrl(upload.local_url || upload.public_url) || undefined} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MessageSquare size={16} className="text-gold" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{upload.guest_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-warm capitalize">{upload.type}</span>
                  {getStatusBadge(upload)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!upload.is_approved && (
                  <button onClick={() => handleAction(upload, 'approve')} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title={t('approve') || 'Approve'}>
                    <CheckCircle size={16} />
                  </button>
                )}
                <button onClick={() => handleAction(upload, 'feature')} className={`p-1.5 rounded-lg hover:bg-gold/10 ${upload.is_featured ? 'text-gold' : 'text-muted-warm'}`} title={upload.is_featured ? 'Unfeature' : (t('feature') || 'Feature')}>
                  <Star size={16} />
                </button>
                {/* Toggle hide/show */}
                {upload.is_hidden ? (
                  <button onClick={() => handleAction(upload, 'unhide')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="Make Visible">
                    <Eye size={16} />
                  </button>
                ) : (
                  <button onClick={() => handleAction(upload, 'hide')} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-warm hover:text-red-500" title={t('hide') || 'Hide'}>
                    <EyeOff size={16} />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to permanently delete this memory from the app and cloud storage?')) {
                      handleAction(upload, 'delete');
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                  title={t('delete') || 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
