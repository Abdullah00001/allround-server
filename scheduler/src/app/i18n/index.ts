/**
 * English dictionary — fallback for all 18 company locales without authored copy.
 */
const enDictionary = {
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

const deDictionary: { [K in keyof typeof enDictionary]: string } = {
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
 * Static i18n for scheduler-produced push notifications (all 18 locales registered).
 * Authored: `en`, `de`. Other locales use English until authored.
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

export type TranslationKey = keyof typeof enDictionary;

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
  const activeLocale = (locale || 'de').toLowerCase().slice(0, 2);
  const dict = i18nDictionaries[activeLocale] ?? i18nDictionaries.en;

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
