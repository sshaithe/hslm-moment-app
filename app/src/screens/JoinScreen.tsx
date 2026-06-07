import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';

export default function JoinScreen() {
  const navigate = useNavigate();
  const { wedding, registerGuest } = useDatabase();
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const isValid = firstName.trim() && lastName.trim() && consent;

  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!firstName.trim()) newErrors.firstName = true;
    if (!lastName.trim()) newErrors.lastName = true;
    if (!consent) newErrors.consent = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await registerGuest(firstName.trim(), lastName.trim(), tableNumber.trim());
    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get('redirect') || '/';
    navigate(redirectPath);
  };

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Venue Header */}
      <div className="relative h-40">
        <img src="/venue.jpg" alt="Venue" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ivory/30 to-ivory" />
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <ArrowLeft size={16} className="text-charcoal" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 -mt-4 relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl text-charcoal mb-2">{t('welcome')}</h1>
          <p className="text-sm text-muted-warm">
            {wedding.couple_name} &mdash; {t('enterDetails')}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                placeholder={t('firstName')}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: false })); }}
                className={`w-full bg-transparent border-b-2 px-0 py-3 text-charcoal placeholder:text-muted-warm/60 focus:outline-none transition-colors text-sm ${
                  errors.firstName ? 'border-red-400' : 'border-accent-border focus:border-gold'
                }`}
              />
            </div>
            <div>
              <input
                type="text"
                placeholder={t('lastName')}
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: false })); }}
                className={`w-full bg-transparent border-b-2 px-0 py-3 text-charcoal placeholder:text-muted-warm/60 focus:outline-none transition-colors text-sm ${
                  errors.lastName ? 'border-red-400' : 'border-accent-border focus:border-gold'
                }`}
              />
            </div>
          </div>

          <input
            type="text"
            placeholder={t('tableNumber')}
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="w-full bg-transparent border-b-2 border-accent-border focus:border-gold px-0 py-3 text-charcoal placeholder:text-muted-warm/60 focus:outline-none transition-colors text-sm"
          />

          {/* Consent */}
          <label className="flex items-start gap-3 pt-2 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => { setConsent(e.target.checked); setErrors((p) => ({ ...p, consent: false })); }}
                className="sr-only peer"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                consent ? 'bg-gold border-gold' : errors.consent ? 'border-red-400' : 'border-accent-border'
              }`}>
                {consent && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-warm leading-relaxed">
              {t('agreeShare')}
            </span>
          </label>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full py-3.5 rounded-full font-medium text-sm mt-6 transition-all ${
              isValid
                ? 'bg-charcoal text-ivory hover:bg-charcoal/90 active:scale-[0.98]'
                : 'bg-charcoal/20 text-muted-warm/50 cursor-not-allowed'
            }`}
          >
            {t('enterGallery')}
          </button>

          {/* Privacy Note */}
          <div className="flex items-center justify-center gap-1.5 pt-4">
            <Lock size={12} className="text-muted-warm/60" />
            <span className="text-[11px] text-muted-warm/60">{t('privacyNote')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
