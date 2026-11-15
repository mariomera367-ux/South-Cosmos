import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'es' | 'en';

interface LanguageContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
  t: (es: string, en: string) => string;
}

const STORAGE_KEY = 'analogo_planetario_lang';

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  setLang: () => {},
  toggleLang: () => {},
  t: (es) => es,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'es';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'es') return saved;
    } catch {
      // Ignorar acceso bloqueado a localStorage
    }
    return 'es';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.title =
        lang === 'en'
          ? 'Planetary Analog — Environmental Analogy Comparator'
          : 'Análogo Planetario — Comparador de Analogía Ambiental';
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignorar
    }
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      toggleLang: () => setLangState((prev) => (prev === 'es' ? 'en' : 'es')),
      t: (es: string, en: string) => (lang === 'en' ? en : es),
    }),
    [lang]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
