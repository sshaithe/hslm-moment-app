import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';

export default function QRScreen() {
  const { wedding } = useDatabase();
  const { t, language } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const posterRef = useRef<HTMLDivElement>(null);

  const weddingUrl = `${window.location.origin}/wedding/${wedding.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(weddingUrl).then(() => {
      addToast(t('linkCopied'), 'success');
    });
  };

  const handleDownload = () => {
    const svg = posterRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 600;
      canvas.height = 800;
      if (ctx) {
        // Background color
        ctx.fillStyle = '#FAF8F4';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the QR code image in the middle
        ctx.drawImage(img, 175, 300, 250, 250);

        // Gold top and bottom borders
        const goldGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        goldGrad.addColorStop(0, '#B8975A');
        goldGrad.addColorStop(0.5, '#D4AF37');
        goldGrad.addColorStop(1, '#B8975A');
        
        ctx.fillStyle = goldGrad;
        ctx.fillRect(0, 0, canvas.width, 12);
        ctx.fillRect(0, canvas.height - 12, canvas.width, 12);

        // Corner ornaments
        ctx.strokeStyle = 'rgba(184, 151, 90, 0.4)';
        ctx.lineWidth = 3;
        // Top-left
        ctx.beginPath(); ctx.moveTo(30, 60); ctx.lineTo(30, 30); ctx.lineTo(60, 30); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(570, 60); ctx.lineTo(570, 30); ctx.lineTo(540, 30); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(30, 740); ctx.lineTo(30, 770); ctx.lineTo(60, 770); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(570, 740); ctx.lineTo(570, 770); ctx.lineTo(540, 770); ctx.stroke();

        // "YOU ARE INVITED" text
        ctx.fillStyle = '#B8975A';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('youAreInvited').toUpperCase(), canvas.width / 2, 110);

        // Couple Name
        ctx.fillStyle = '#2C2418';
        ctx.font = 'italic 40px Georgia';
        ctx.fillText(wedding.couple_name, canvas.width / 2, 180);

        // Date
        ctx.fillStyle = '#8A7D6B';
        ctx.font = '18px sans-serif';
        const dateStr = new Date(wedding.wedding_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        ctx.fillText(dateStr, canvas.width / 2, 220);

        // Venue
        ctx.fillStyle = 'rgba(138, 125, 107, 0.7)';
        ctx.font = '15px sans-serif';
        ctx.fillText(wedding.venue, canvas.width / 2, 255);

        // Bottom texts
        ctx.fillStyle = '#2C2418';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(t('scanToShare'), canvas.width / 2, 600);

        ctx.fillStyle = '#8A7D6B';
        ctx.font = '15px sans-serif';
        ctx.fillText(t('uploadDescription'), canvas.width / 2, 635);

        // HSLM Moment Brand
        ctx.fillStyle = '#B8975A';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('HSLM MOMENT', canvas.width / 2, 720);

        const link = document.createElement('a');
        link.download = `vowvault-qr-${wedding.slug}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <h1 className="font-heading text-2xl text-charcoal">{t('qrCode')}</h1>

      {/* Poster Preview */}
      <div ref={posterRef} className="bg-white rounded-2xl p-8 shadow-elevated max-w-md mx-auto text-center relative overflow-hidden">
        {/* Gold Border Bars */}
        <div className="absolute top-0 left-0 right-0 h-1.5 gradient-gold" />
        <div className="absolute bottom-0 left-0 right-0 h-1.5 gradient-gold" />

        {/* Corner Ornaments */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-gold/30" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-gold/30" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-gold/30" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-gold/30" />

        <p className="text-[10px] font-semibold uppercase tracking-[3px] text-gold mb-6">
          {t('youAreInvited')}
        </p>

        <h2 className="font-heading text-3xl text-charcoal italic mb-2">{wedding.couple_name}</h2>
        <p className="text-sm text-muted-warm mb-1">
          {new Date(wedding.wedding_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="text-xs text-muted-warm/70 mb-6">{wedding.venue}</p>

        {/* QR Code */}
        <div className="inline-block p-4 bg-white rounded-xl shadow-card border border-accent-border/30 mb-6">
          <QRCodeSVG
            value={weddingUrl}
            size={180}
            level="M"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#2C2418"
          />
        </div>

        <p className="text-sm font-medium text-charcoal mb-1">{t('scanToShare')}</p>
        <p className="text-xs text-muted-warm mb-4">{t('uploadDescription')}</p>

        <div className="flex items-center justify-center gap-1.5 text-gold">
          <div className="w-4 h-4 rounded-full border border-gold flex items-center justify-center">
            <span className="text-[8px] font-bold">H</span>
          </div>
          <span className="text-[10px] font-medium tracking-wider">HSLM MOMENT</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full gradient-gold text-white text-sm font-medium shadow-elevated"
        >
          <Download size={16} />
          {t('downloadQRPoster')}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-charcoal text-ivory text-sm font-medium"
        >
          <Copy size={16} />
          {t('copyPrivateLink')}
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-warm/50 font-mono break-all">{weddingUrl}</p>
      </div>
    </div>
  );
}
