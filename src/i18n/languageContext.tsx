import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppLanguage } from '../types/assistant';
import { TRANSLATIONS, type TranslationDictionary } from './translations';

const LANGUAGE_STORAGE_KEY = 'neuron_mind_language_v1';
const AUTO_DETECT_STORAGE_KEY = 'neuron_mind_auto_detect_lang_v1';

interface LanguageContextValue {
  language: AppLanguage;
  dir: 'ltr' | 'rtl';
  autoDetectLanguage: boolean;
  t: TranslationDictionary;
  setLanguage: (lang: AppLanguage) => void;
  setAutoDetectLanguage: (enabled: boolean) => void;
  formatDateTime: (iso: string) => string;
  formatTime: (iso: string) => string;
  formatNumber: (value: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'fa' ? 'fa' : 'en';
  } catch {
    return 'en';
  }
}

function readInitialAutoDetect(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(AUTO_DETECT_STORAGE_KEY);
    return stored === 'false' ? false : true;
  } catch {
    return true;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);
  const [autoDetectLanguage, setAutoDetectState] = useState<boolean>(
    readInitialAutoDetect
  );

  const dir: 'ltr' | 'rtl' = language === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const setAutoDetectLanguage = useCallback((enabled: boolean) => {
    setAutoDetectState(enabled);
    try {
      window.localStorage.setItem(AUTO_DETECT_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const formatDateTime = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    },
    [language]
  );

  const formatTime = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    },
    [language]
  );

  const formatNumber = useCallback(
    (value: number) =>
      new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US').format(value),
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      dir,
      autoDetectLanguage,
      t: TRANSLATIONS[language],
      setLanguage,
      setAutoDetectLanguage,
      formatDateTime,
      formatTime,
      formatNumber,
    }),
    [
      language,
      dir,
      autoDetectLanguage,
      setLanguage,
      setAutoDetectLanguage,
      formatDateTime,
      formatTime,
      formatNumber,
    ]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider.');
  }
  return ctx;
}
