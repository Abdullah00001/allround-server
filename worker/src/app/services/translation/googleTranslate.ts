import { env } from '@/env';
import logger from '@/app/configs/logger.configs';

/**
 * Decodes common HTML entities returned by the Google Translate API.
 *
 * @param {string} text - Translated text that may contain entities.
 * @returns {string} Decoded plain text.
 */
export const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

/**
 * Translates a batch of strings via Google Cloud Translation API v2.
 * Uses `env.GOOGLE_TRANSLATION_API_KEY`. Returns source texts unchanged when
 * the provider is not `google` or the API key is missing.
 *
 * @param {string[]} texts - Source strings to translate.
 * @param {string} sourceLocale - Source language code.
 * @param {string} targetLocale - Target language code.
 * @returns {Promise<string[]>} Translated strings (same order/length).
 */
export const translateTextsWithGoogle = async (
  texts: string[],
  sourceLocale: string,
  targetLocale: string
): Promise<string[]> => {
  if (texts.length === 0) return [];

  if (
    env.TRANSLATION_PROVIDER.toLowerCase() !== 'google' ||
    !env.GOOGLE_TRANSLATION_API_KEY
  ) {
    logger.warn(
      '[translateTextsWithGoogle] Provider unavailable; returning source texts'
    );
    return texts;
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
    env.GOOGLE_TRANSLATION_API_KEY
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texts,
        source: sourceLocale.toLowerCase().slice(0, 2),
        target: targetLocale.toLowerCase().slice(0, 2),
        format: 'text',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Translate API failed (${response.status}): ${errorBody}`
      );
    }

    const json = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };

    const translations = json.data?.translations ?? [];
    return texts.map((original, index) => {
      const translated = translations[index]?.translatedText;
      return translated ? decodeHtmlEntities(translated) : original;
    });
  } finally {
    clearTimeout(timeout);
  }
};
