/**
 * Alua-style static i18n dictionaries for scheduler-produced push notifications.
 * Unsupported locales fall back to English.
 */
export const i18nDictionaries = {
  en: {
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
 * Falls back to English when the locale or key is missing.
 *
 * @param {TranslationKey} key - Dictionary key.
 * @param {string} [locale] - Preferred locale (e.g. `DE`, `en`).
 * @param {Record<string, string | number>} [params] - `{token}` interpolations.
 * @returns {string} Localized message.
 */
export const t = (
  key: TranslationKey,
  locale?: string,
  params?: Record<string, string | number>
): string => {
  const activeLocale = (locale || 'en').toLowerCase().slice(0, 2);
  const dict =
    activeLocale === 'de' ? i18nDictionaries.de : i18nDictionaries.en;

  let message: string = dict[key] || i18nDictionaries.en[key] || String(key);

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
