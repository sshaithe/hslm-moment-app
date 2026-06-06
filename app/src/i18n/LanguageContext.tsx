import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { tr } from './tr';
import type { Language } from '@/lib/types';
import { getStoredLanguage, storeLanguage } from '@/lib/localStore';

type TranslationKey = keyof typeof en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage());

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    storeLanguage(lang);
  };

  const t = (key: TranslationKey, vars?: Record<string, string>): string => {
    const translations = language === 'tr' ? tr : en;
    let text = (translations[key] || en[key] || key) as string;
    
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
