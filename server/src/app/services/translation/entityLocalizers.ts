import { TRANSLATION_CONFIG } from '@/const';
import { getLocale } from '@/app/configs/requestContext.configs';
import {
  applyLocalization,
  localizeMany,
} from '@/app/services/translation/localize.helper';
import {
  getOrTranslateContent,
  preTranslateContent,
} from '@/app/services/translation/translation.service';
import type { ILocalizationMeta } from '@/app/services/translation/translation.types';
import type { TranslationContentType } from '@/const';
import logger from '@/app/configs/logger.configs';

const F = TRANSLATION_CONFIG.TRANSLATABLE_FIELDS;

/**
 * Fire-and-forget pre-translate into enabled company languages (alua parity).
 *
 * @param {object} params - Content identity + source fields.
 * @returns {void}
 */
export const enqueuePreTranslate = ({
  contentType,
  contentId,
  fields,
  sourceLocale = TRANSLATION_CONFIG.DEFAULT_LOCALE,
}: {
  contentType: TranslationContentType;
  contentId: string;
  fields: Record<string, string | null | undefined>;
  sourceLocale?: string;
}): void => {
  preTranslateContent({
    contentType,
    contentId,
    sourceLocale,
    fields,
  }).catch((err) => {
    logger.error('[enqueuePreTranslate] Failed', {
      contentType,
      contentId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
};

export const localizeLegalContent = <
  T extends { id: string; content: string },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'LEGAL_CONTENT',
    contentId: entity.id,
    fieldKeys: F.LEGAL_CONTENT,
  });

/**
 * Localizes a notification for the active request locale.
 * Uses **synchronous** translate when not yet READY so inbox/`preferredLanguage`
 * is not stuck on `PENDING` with source copy on first fetch.
 *
 * @param {T} entity - Notification id + source title/message.
 * @returns {Promise<T & { localization?: ILocalizationMeta }>} Localized row.
 */
export const localizeNotification = async <
  T extends { id: string; title: string; message: string },
>(
  entity: T
): Promise<T & { localization?: ILocalizationMeta }> => {
  const sourceLocale = TRANSLATION_CONFIG.DEFAULT_LOCALE;
  const result = await getOrTranslateContent<{
    title: string;
    message: string;
  }>({
    contentType: 'NOTIFICATION',
    contentId: entity.id,
    sourceLocale,
    targetLocale: getLocale(),
    fields: { title: entity.title, message: entity.message },
    synchronous: true,
  });

  return {
    ...entity,
    title: result.fields.title ?? entity.title,
    message: result.fields.message ?? entity.message,
    localization: {
      sourceLocale: sourceLocale.toLowerCase().slice(0, 2),
      displayedLocale: result.displayedLocale,
      isTranslated: result.isTranslated,
      translationStatus: result.translationStatus,
    },
  };
};

export const localizeProjectNote = <
  T extends { id: string; content: string },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'PROJECT_NOTE',
    contentId: entity.id,
    fieldKeys: F.PROJECT_NOTE,
  });

export const localizeProjectTask = <
  T extends { id: string; title: string; description?: string | null },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'PROJECT_TASK',
    contentId: entity.id,
    fieldKeys: F.PROJECT_TASK,
  });

export const localizeProject = <
  T extends { id: string; name: string; siteAccessNotes?: string | null },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'PROJECT',
    contentId: entity.id,
    fieldKeys: F.PROJECT,
  });

export const localizeCustomer = <T extends { id: string; name: string }>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'CUSTOMER',
    contentId: entity.id,
    fieldKeys: F.CUSTOMER,
  });

export const localizeCustomerContact = <
  T extends { id: string; name: string; role: string },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'CUSTOMER_CONTACT',
    contentId: entity.id,
    fieldKeys: F.CUSTOMER_CONTACT,
  });

export const localizeInspection = <
  T extends {
    id: string;
    siteTitle: string;
    siteAccessInstructions?: string | null;
    specialRequirements?: string | null;
    scaffoldType?: string | null;
  },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'INSPECTION',
    contentId: entity.id,
    fieldKeys: F.INSPECTION,
  });

export const localizeProjectMeasurement = <
  T extends {
    id: string;
    position?: string | null;
    remark?: string | null;
    scaffoldType?: string | null;
  },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'PROJECT_MEASUREMENT',
    contentId: entity.id,
    fieldKeys: F.PROJECT_MEASUREMENT,
  });

export const localizeVehicle = <T extends { id: string; name: string }>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'VEHICLE',
    contentId: entity.id,
    fieldKeys: F.VEHICLE,
  });

export const localizeAuditLog = <T extends { id: string; details: string }>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'AUDIT_LOG',
    contentId: entity.id,
    fieldKeys: F.AUDIT_LOG,
  });

export const localizeUser = <
  T extends { id: string; firstName: string; lastName: string },
>(
  entity: T
) =>
  applyLocalization({
    entity,
    contentType: 'USER',
    contentId: entity.id,
    fieldKeys: F.USER,
  });

export { localizeMany };
