import { Language } from '@prisma/client';
import {
  LANGUAGE_CATALOG,
  TRANSLATION_CONFIG,
} from '@/const';

/**
 * Maps Prisma `Language` → lowercase ISO locale used by Translate / i18n.
 *
 * @param {Language | string} language - Enum or string code.
 * @returns {string} Two-letter locale (fallback `de`).
 */
export const languageToLocale = (language: Language | string): string => {
  const code = String(language).toUpperCase();
  const row = LANGUAGE_CATALOG.find((item) => item.code === code);
  if (row) return row.locale;
  const normalized = code.toLowerCase().slice(0, 2);
  return (TRANSLATION_CONFIG.SUPPORTED_LOCALES as readonly string[]).includes(
    normalized
  )
    ? normalized
    : TRANSLATION_CONFIG.DEFAULT_LOCALE;
};

/**
 * Maps lowercase locale → Prisma `Language` when known.
 *
 * @param {string} locale - Two-letter locale.
 * @returns {Language | null} Matching enum or null.
 */
export const localeToLanguage = (locale: string): Language | null => {
  const normalized = locale.trim().toLowerCase().slice(0, 2);
  const row = LANGUAGE_CATALOG.find((item) => item.locale === normalized);
  if (!row) return null;
  return row.code as Language;
};

/**
 * True when locale is one of the 18 supported company languages.
 *
 * @param {string} locale - Candidate locale.
 * @returns {boolean} Whether the locale is supported.
 */
export const isSupportedLocale = (locale: string): boolean => {
  const normalized = locale.trim().toLowerCase().slice(0, 2);
  return (TRANSLATION_CONFIG.SUPPORTED_LOCALES as readonly string[]).includes(
    normalized
  );
};
