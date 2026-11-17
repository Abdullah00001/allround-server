import { ITranslationProvider } from '@/app/services/translation/translation.types';

/**
 * No-op provider used when translation is disabled (e.g. missing API key).
 */
export class DisabledTranslationProvider implements ITranslationProvider {
  public readonly name = 'disabled';

  public async translateText(
    text: string,
    _sourceLocale: string,
    _targetLocale: string
  ): Promise<string> {
    return text;
  }

  public async translateBatch(
    fields: Record<string, string>,
    _sourceLocale: string,
    _targetLocale: string
  ): Promise<Record<string, string>> {
    return { ...fields };
  }
}
