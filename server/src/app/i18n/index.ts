import { getLocale } from '@/app/configs/requestContext.configs';
import { TRANSLATION_CONFIG } from '@/const';

/**
 * English dictionary — fallback for all 18 company locales without authored copy.
 */
const enDictionary = {
  'otp.subject': 'Your Allround verification code',
  'welcome.subject': 'Welcome to Allround. Please verify your email.',
  'password.reset.subject': 'Your password has been reset successfully',
  'notification.project_assigned.title': 'Project assignment',
  'notification.project_assigned.body':
    'You have been assigned to {projectName} ({phaseType}) on {date}.',
  'notification.time_log_approved.title': 'Time log approved',
  'notification.time_log_approved.body':
    'Your time entry for {date} was approved.',
  'notification.time_log_rejected.title': 'Time log rejected',
  'notification.time_log_rejected.body':
    'Your time entry for {date} was rejected.',
  'notification.inspection_scheduled.title': 'Inspection converted',
  'notification.inspection_scheduled.body':
    'Inspection "{siteTitle}" was converted to project "{projectName}".',
  'notification.inspection_reminder.title': 'Inspection tomorrow',
  'notification.inspection_reminder.body':
    'You have an inspection at "{siteTitle}" on {date}.',
  'notification.timer_auto_closed.title': 'Timer auto-closed',
  'notification.timer_auto_closed.body':
    'Your open timer was closed at end of day and awaits approval.',
  'notification.absence_reminder.title': 'Absence tomorrow',
  'notification.absence_reminder.body':
    'Reminder: you have a registered absence starting {date}.',
} as const;

/**
 * Authored German dictionary (company default locale).
 */
const deDictionary: { [K in keyof typeof enDictionary]: string } = {
  'otp.subject': 'Ihr Allround-Bestätigungscode',
  'welcome.subject':
    'Willkommen bei Allround. Bitte bestätigen Sie Ihre E-Mail.',
  'password.reset.subject': 'Ihr Passwort wurde erfolgreich zurückgesetzt',
  'notification.project_assigned.title': 'Projekteinsatz',
  'notification.project_assigned.body':
    'Sie wurden dem Projekt {projectName} ({phaseType}) am {date} zugewiesen.',
  'notification.time_log_approved.title': 'Zeiteintrag genehmigt',
  'notification.time_log_approved.body':
    'Ihr Zeiteintrag vom {date} wurde genehmigt.',
  'notification.time_log_rejected.title': 'Zeiteintrag abgelehnt',
  'notification.time_log_rejected.body':
    'Ihr Zeiteintrag vom {date} wurde abgelehnt.',
  'notification.inspection_scheduled.title': 'Besichtigung umgewandelt',
  'notification.inspection_scheduled.body':
    'Die Besichtigung "{siteTitle}" wurde zum Projekt "{projectName}" umgewandelt.',
  'notification.inspection_reminder.title': 'Besichtigung morgen',
  'notification.inspection_reminder.body':
    'Sie haben morgen eine Besichtigung bei "{siteTitle}" ({date}).',
  'notification.timer_auto_closed.title': 'Timer automatisch geschlossen',
  'notification.timer_auto_closed.body':
    'Ihr offener Timer wurde am Tagesende geschlossen und wartet auf Freigabe.',
  'notification.absence_reminder.title': 'Abwesenheit morgen',
  'notification.absence_reminder.body':
    'Erinnerung: Sie haben eine Abwesenheit ab {date}.',
};

/**
 * Static i18n for system emails / push templates across all 18 company locales.
 * Authored: `en`, `de`. Remaining locales fall back to English at lookup time.
 * Dynamic CMS content (legal, notes, …) uses the Translation pipeline instead.
 */
export const i18nDictionaries: Record<
  string,
  { [K in keyof typeof enDictionary]: string }
> = {
  en: { ...enDictionary },
  de: deDictionary,
  pl: { ...enDictionary },
  ro: { ...enDictionary },
  tr: { ...enDictionary },
  bg: { ...enDictionary },
  hr: { ...enDictionary },
  sr: { ...enDictionary },
  uk: { ...enDictionary },
  ru: { ...enDictionary },
  sq: { ...enDictionary },
  it: { ...enDictionary },
  fr: { ...enDictionary },
  es: { ...enDictionary },
  pt: { ...enDictionary },
  nl: { ...enDictionary },
  el: { ...enDictionary },
  hu: { ...enDictionary },
};

/**
 * Known translation key union derived from the English dictionary.
 */
export type TranslationKey = keyof typeof enDictionary;

/**
 * Resolves a localized string from the static dictionaries.
 * Locale resolution: explicit `locale` → AsyncLocalStorage `getLocale()` → default.
 * Unknown locales / missing keys fall back to English.
 *
 * @param {TranslationKey} key - Dictionary key.
 * @param {string} [locale] - Preferred locale (e.g. `DE`, `en`); optional when ALS is set.
 * @param {Record<string, string | number>} [params] - `{token}` interpolations.
 * @returns {string} Localized message.
 */
export const t = (
  key: TranslationKey,
  locale?: string,
  params?: Record<string, string | number>
): string => {
  const activeLocale = (locale || getLocale() || TRANSLATION_CONFIG.DEFAULT_LOCALE)
    .toLowerCase()
    .slice(0, 2);
  const supported = TRANSLATION_CONFIG.SUPPORTED_LOCALES as readonly string[];
  const normalized = supported.includes(activeLocale)
    ? activeLocale
    : TRANSLATION_CONFIG.DEFAULT_LOCALE;
  const dict = i18nDictionaries[normalized] ?? i18nDictionaries.en;

  let message: string =
    dict[key] || i18nDictionaries.en[key] || String(key);

  if (params) {
    for (const [token, value] of Object.entries(params)) {
      message = message.replace(
        new RegExp(`\\{${token}\\}`, 'g'),
        String(value)
      );
    }
  }

  return message;
};
