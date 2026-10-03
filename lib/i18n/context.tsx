"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import en from "./dictionaries/en.json";
import hi from "./dictionaries/hi.json";
import hinglish from "./dictionaries/hinglish.json";
import mr from "./dictionaries/mr.json";
import bn from "./dictionaries/bn.json";
import gu from "./dictionaries/gu.json";
import ta from "./dictionaries/ta.json";
import te from "./dictionaries/te.json";
import pa from "./dictionaries/pa.json";
import kn from "./dictionaries/kn.json";
import ml from "./dictionaries/ml.json";

export type LanguageCode =
  | "en"
  | "hi"
  | "hinglish"
  | "mr"
  | "bn"
  | "gu"
  | "ta"
  | "te"
  | "pa"
  | "kn"
  | "ml";

export const AVAILABLE_LANGUAGES: {
  code: LanguageCode;
  name: string;
  nativeName: string;
}[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "hinglish", name: "Hinglish (Hindi)", nativeName: "Hinglish" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
];

const DICTIONARIES: Record<LanguageCode, any> = {
  en,
  hi,
  hinglish,
  mr,
  bn,
  gu,
  ta,
  te,
  pa,
  kn,
  ml,
};

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  dir: "ltr",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vyaparsetu_lang") as LanguageCode | null;
      if (saved && DICTIONARIES[saved]) {
        setLanguageState(saved);
      }
    } catch {
      // Ignore local storage error
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("vyaparsetu_lang", lang);
    } catch {
      // Ignore local storage error
    }
  };

  const t = useMemo(() => {
    return (keyPath: string, fallback?: string): string => {
      const parts = keyPath.split(".");
      let current = DICTIONARIES[language];

      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = current[part];
        } else {
          // Fallback to English dictionary
          let enFallback = DICTIONARIES.en;
          for (const p of parts) {
            if (enFallback && typeof enFallback === "object" && p in enFallback) {
              enFallback = enFallback[p];
            } else {
              enFallback = undefined;
              break;
            }
          }
          return typeof enFallback === "string" ? enFallback : (fallback || keyPath);
        }
      }

      return typeof current === "string" ? current : (fallback || keyPath);
    };
  }, [language]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        dir: "ltr",
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
