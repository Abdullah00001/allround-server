import { getLocale } from '@/app/configs/requestContext.configs';

/**
 * Alua-style static i18n dictionaries for system emails and push notifications.
 * Unsupported locales fall back to English.
 */
export const i18nDictionaries = {
  en: {
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
  },
  de: {
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
  },
} as const;

/**
 * Known translation key union derived from the English dictionary.
 */
export type TranslationKey = keyof (typeof i18nDictionaries)['en'];

/**
 * Resolves a localized string from the static dictionaries.
 * Locale resolution: explicit `locale` → AsyncLocalStorage `getLocale()` → `en`.
 * Falls back to English when the locale or key is missing.
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
  const activeLocale = (locale || getLocale() || 'en').toLowerCase().slice(0, 2);
  const dict =
    activeLocale === 'de' ? i18nDictionaries.de : i18nDictionaries.en;

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
