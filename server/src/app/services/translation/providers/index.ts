import { env } from '@/env';
import logger from '@/app/configs/logger.configs';
import { ITranslationProvider } from '@/app/services/translation/translation.types';
import { DisabledTranslationProvider } from '@/app/services/translation/providers/disabled.provider';
import { GoogleTranslateProvider } from '@/app/services/translation/providers/google.provider';
import { MockTranslationProvider } from '@/app/services/translation/providers/mock.provider';

let _providerInstance: ITranslationProvider | null = null;

/**
 * Resolves the active translation provider from env (alua-compatible).
 *
 * @returns {ITranslationProvider} Singleton provider instance.
 */
export const getTranslationProvider = (): ITranslationProvider => {
  if (_providerInstance) {
    return _providerInstance;
  }

  const isProduction = env.NODE_ENV.toLowerCase() === 'production';
  const providerType = (
    env.TRANSLATION_PROVIDER || (isProduction ? 'disabled' : 'mock')
  ).toLowerCase();
  const apiKey = env.GOOGLE_TRANSLATION_API_KEY;

  if (isProduction) {
    if (providerType === 'mock') {
      logger.error(
        '[TranslationProvider] Mock provider forbidden in production; disabling.'
      );
      _providerInstance = new DisabledTranslationProvider();
      return _providerInstance;
    }

    if (providerType === 'google') {
      if (!apiKey) {
        logger.error(
          '[TranslationProvider] Google selected but API key missing; disabling.'
        );
        _providerInstance = new DisabledTranslationProvider();
      } else {
        _providerInstance = new GoogleTranslateProvider(apiKey);
      }
      return _providerInstance;
    }

    _providerInstance = new DisabledTranslationProvider();
    return _providerInstance;
  }

  if (providerType === 'google') {
    if (!apiKey) {
      logger.warn(
        '[TranslationProvider] Google selected without key; using mock.'
      );
      _providerInstance = new MockTranslationProvider();
    } else {
      _providerInstance = new GoogleTranslateProvider(apiKey);
    }
  } else {
    _providerInstance = new MockTranslationProvider();
  }

  return _providerInstance;
};
