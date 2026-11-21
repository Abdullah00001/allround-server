import { getLocale } from '@/app/configs/requestContext.configs';
import {
  getOrTranslateContent,
} from '@/app/services/translation/translation.service';
import type { ILocalizationMeta } from '@/app/services/translation/translation.types';
import {
  TRANSLATION_CONFIG,
  type TranslationContentType,
} from '@/const';

type FieldMap = Record<string, string | null | undefined>;

/**
 * Localizes fields for the active request locale (`x-locale` / preference).
 *
 * @param {{ contentType: TranslationContentType; contentId: string; fields: T; sourceLocale?: string }} params - Localize request.
 * @returns {Promise<{ fields: T; localization: ILocalizationMeta }>} Merged fields + meta.
 */
export const localizeFields = async <T extends FieldMap>({
  contentType,
  contentId,
  fields,
  sourceLocale = TRANSLATION_CONFIG.DEFAULT_LOCALE,
}: {
  contentType: TranslationContentType;
  contentId: string;
  fields: T;
  sourceLocale?: string;
}): Promise<{ fields: T; localization: ILocalizationMeta }> => {
  const targetLocale = getLocale();
  const result = await getOrTranslateContent<T>({
    contentType,
    contentId,
    sourceLocale,
    targetLocale,
    fields,
  });

  return {
    fields: { ...fields, ...result.fields },
    localization: {
      sourceLocale: (
        sourceLocale || TRANSLATION_CONFIG.DEFAULT_LOCALE
      ).toLowerCase().slice(0, 2),
      displayedLocale: result.displayedLocale,
      isTranslated: result.isTranslated,
      translationStatus: result.translationStatus,
    },
  };
};

/**
 * Applies localization onto a plain object / DTO and attaches `localization` meta.
 *
 * @param {{ entity: T; contentType: TranslationContentType; contentId: string; fieldKeys: readonly string[]; sourceLocale?: string }} params - Entity + keys.
 * @returns {Promise<T & { localization?: ILocalizationMeta }>} Localized entity.
 */
export const applyLocalization = async <T extends Record<string, unknown>>({
  entity,
  contentType,
  contentId,
  fieldKeys,
  sourceLocale,
}: {
  entity: T;
  contentType: TranslationContentType;
  contentId: string;
  fieldKeys: readonly string[];
  sourceLocale?: string;
}): Promise<T & { localization?: ILocalizationMeta }> => {
  const fields: FieldMap = {};
  for (const key of fieldKeys) {
    const val = entity[key];
    fields[key] =
      typeof val === 'string' ? val : val == null ? null : String(val);
  }

  const { fields: localized, localization } = await localizeFields({
    contentType,
    contentId,
    fields,
    sourceLocale,
  });

  const next = { ...entity, localization } as T & {
    localization?: ILocalizationMeta;
  };
  for (const key of fieldKeys) {
    if (localized[key] !== undefined) {
      (next as Record<string, unknown>)[key] = localized[key];
    }
  }
  return next;
};

/**
 * Localizes a list of items in parallel.
 *
 * @param {T[]} items - Items to localize.
 * @param {(item: T) => Promise<R>} localize - Per-item localizer.
 * @returns {Promise<R[]>} Localized items.
 */
export const localizeMany = async <T, R>(
  items: T[],
  localize: (item: T) => Promise<R>
): Promise<R[]> => Promise.all(items.map(localize));
