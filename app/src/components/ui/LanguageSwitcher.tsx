import { useLanguage } from '@/i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'tr' ? 'en' : 'tr');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="text-xs font-medium text-muted-warm hover:text-gold transition-colors px-2 py-1 rounded-full border border-accent-border/50"
    >
      {language === 'tr' ? 'EN' : 'TR'}
    </button>
  );
}
