import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import i18n from "@/i18n";

type Lang = "fr" | "en";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("lang") as Lang | null) ?? "fr"
  );

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === "fr" ? "en" : "fr");
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
