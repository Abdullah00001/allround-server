import { ITranslationProvider } from '@/app/services/translation/translation.types';

/**
 * Dev/test provider that prefixes strings with the target locale tag.
 */
export class MockTranslationProvider implements ITranslationProvider {
  public readonly name = 'mock';

  public async translateText(
    text: string,
    _sourceLocale: string,
    targetLocale: string
  ): Promise<string> {
    return `[${targetLocale}] ${text}`;
  }

  public async translateBatch(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      result[key] = await this.translateText(value, sourceLocale, targetLocale);
    }
    return result;
  }
}
