import { TRANSLATION_CONFIG } from '@/const';
import { ITranslationProvider } from '@/app/services/translation/translation.types';

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * Google Cloud Translation API v2 provider (alua-compatible).
 */
export class GoogleTranslateProvider implements ITranslationProvider {
  public readonly name = 'google';

  constructor(private readonly apiKey: string) {}

  public async translateText(
    text: string,
    sourceLocale: string,
    targetLocale: string
  ): Promise<string> {
    const batch = await this.translateBatch(
      { text },
      sourceLocale,
      targetLocale
    );
    return batch.text ?? text;
  }

  public async translateBatch(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return {};

    const supported = TRANSLATION_CONFIG.SUPPORTED_LOCALES as readonly string[];
    const source = supported.includes(sourceLocale.slice(0, 2).toLowerCase())
      ? sourceLocale.slice(0, 2).toLowerCase()
      : TRANSLATION_CONFIG.DEFAULT_LOCALE;
    const target = supported.includes(targetLocale.slice(0, 2).toLowerCase())
      ? targetLocale.slice(0, 2).toLowerCase()
      : TRANSLATION_CONFIG.DEFAULT_LOCALE;

    if (source === target) {
      return { ...fields };
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: keys.map((key) => fields[key]),
          source,
          target,
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
      const result: Record<string, string> = {};
      keys.forEach((key, idx) => {
        result[key] = translations[idx]?.translatedText
          ? decodeHtmlEntities(translations[idx].translatedText!)
          : fields[key];
      });
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
