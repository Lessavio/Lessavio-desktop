import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { uk } from "./locales/uk";

export const supportedLanguages = ["en", "uk", "ru"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageFlags: Record<SupportedLanguage, string> = {
  en: "🇬🇧",
  uk: "🇺🇦",
  ru: "🇷🇺",
};

function savedLanguage(): SupportedLanguage {
  const saved = localStorage.getItem("tutorly-language");
  return supportedLanguages.includes(saved as SupportedLanguage) ? saved as SupportedLanguage : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: savedLanguage(),
  fallbackLng: "en",
  supportedLngs: supportedLanguages,
  load: "languageOnly",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function normalizeLanguage(language?: string): SupportedLanguage {
  const short = language?.split("-")[0] as SupportedLanguage;
  return supportedLanguages.includes(short) ? short : "en";
}

export default i18n;
