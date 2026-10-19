import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LANGUAGES = ["en", "pt-BR"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANG_STORAGE_KEY = "scriptorium.lang";
const DEFAULT_LANGUAGE: Language = "en";

/** Maps any tag (`pt`, `pt-BR`, `en-US`, junk) to one of the shipped locales. */
export function normalizeLanguage(value: unknown): Language {
  if (typeof value !== "string") return DEFAULT_LANGUAGE;
  const tag = value.toLowerCase();
  if (tag === "pt" || tag.startsWith("pt-")) return "pt-BR";
  if (tag === "en" || tag.startsWith("en-")) return "en";
  return DEFAULT_LANGUAGE;
}

export function readStoredLanguage(): Language {
  try {
    return normalizeLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function otherLanguage(language: Language): Language {
  return language === "pt-BR" ? "en" : "pt-BR";
}

/** BCP-47 tag for Intl formatters. */
export function localeFor(language: string): string {
  return normalizeLanguage(language);
}

function persistLanguage(language: string): void {
  const normalized = normalizeLanguage(language);
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
  } catch {
    /* storage unavailable: language still applies for this session */
  }
  if (typeof document !== "undefined") document.documentElement.lang = normalized;
}

const initialLanguage = typeof window === "undefined" ? DEFAULT_LANGUAGE : readStoredLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
});

persistLanguage(initialLanguage);
i18n.on("languageChanged", persistLanguage);

export async function setLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
}

export function useLanguage(): { language: Language; toggleLanguage: () => void } {
  const { i18n: instance } = useTranslation();
  const language = normalizeLanguage(instance.language);
  return {
    language,
    toggleLanguage: () => { void setLanguage(otherLanguage(language)); },
  };
}

export { i18n };
