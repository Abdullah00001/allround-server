import crypto from 'crypto';
import { Prisma, TranslationStatus } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getTranslationQueue } from '@/app/queues/translation/translation.queue';
import { getTranslationProvider } from '@/app/services/translation/providers';
import {
  ITranslateContentParams,
  ITranslatedContentResult,
  ITranslationJobPayload,
} from '@/app/services/translation/translation.types';
import {
  QUEUE_JOBS,
  TRANSLATION_CONFIG,
  type TranslationContentType,
} from '@/const';
import { languageToLocale } from '@/app/utils/language.utils';

export const SUPPORTED_LOCALES = TRANSLATION_CONFIG.SUPPORTED_LOCALES;

/**
 * SHA-256 of eligible non-empty string fields (stable key order).
 *
 * @param {Record<string, string | null | undefined>} fields - Source fields.
 * @returns {string} Hex digest.
 */
export const computeSourceHash = (
  fields: Record<string, string | null | undefined>
): string => {
  const sortedKeys = Object.keys(fields)
    .filter(
      (k) =>
        typeof fields[k] === 'string' && (fields[k] as string).trim().length > 0
    )
    .sort();
  const serialized = sortedKeys
    .map((key) => `${key}:${(fields[key] as string).trim()}`)
    .join('|');
  return crypto.createHash('sha256').update(serialized).digest('hex');
};

/**
 * Heuristic filter for values that should not be machine-translated.
 *
 * @param {string} key - Field name.
 * @param {string} value - Field value.
 * @returns {boolean} True when the value looks translatable.
 */
export const isTranslatableField = (key: string, value: string): boolean => {
  const lowerKey = key.toLowerCase();
  if (
    lowerKey === 'id' ||
    lowerKey.endsWith('id') ||
    lowerKey.includes('url') ||
    lowerKey.includes('email') ||
    lowerKey.includes('date') ||
    lowerKey.includes('token')
  ) {
    return false;
  }

  const trimmed = value.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return false;
  }
  if (
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(
      trimmed
    )
  ) {
    return false;
  }
  if (/^\$?\d+(\.\d+)?$/.test(trimmed)) {
    return false;
  }
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  ) {
    return false;
  }

  return true;
};

/**
 * Returns persisted translation or enqueues an async job (alua-compatible).
 *
 * @param {ITranslateContentParams} params - Content identity + fields.
 * @returns {Promise<ITranslatedContentResult<T>>} Localized fields + meta.
 */
export const getOrTranslateContent = async <T extends Record<string, unknown>>({
  contentType,
  contentId,
  sourceLocale,
  targetLocale,
  fields,
  synchronous = false,
}: ITranslateContentParams): Promise<ITranslatedContentResult<T>> => {
  const rawSource = (
    sourceLocale || TRANSLATION_CONFIG.DEFAULT_LOCALE
  ).toLowerCase().slice(0, 2);
  const rawTarget = (
    targetLocale || TRANSLATION_CONFIG.DEFAULT_LOCALE
  ).toLowerCase().slice(0, 2);

  const normalizedSource = (
    SUPPORTED_LOCALES as readonly string[]
  ).includes(rawSource)
    ? rawSource
    : TRANSLATION_CONFIG.DEFAULT_LOCALE;
  const normalizedTarget = (
    SUPPORTED_LOCALES as readonly string[]
  ).includes(rawTarget)
    ? rawTarget
    : TRANSLATION_CONFIG.DEFAULT_LOCALE;

  if (normalizedSource === normalizedTarget) {
    return {
      fields: fields as T,
      displayedLocale: normalizedSource,
      isTranslated: false,
      translationStatus: TranslationStatus.READY,
    };
  }

  const allowedKeys =
    (TRANSLATION_CONFIG.TRANSLATABLE_FIELDS as Record<string, readonly string[]>)[
      contentType
    ] || [];
  const translatableFields: Record<string, string> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (
      allowedKeys.includes(key) &&
      typeof val === 'string' &&
      val.trim().length > 0 &&
      isTranslatableField(key, val)
    ) {
      translatableFields[key] = val;
    }
  }

  if (Object.keys(translatableFields).length === 0) {
    return {
      fields: fields as T,
      displayedLocale: normalizedSource,
      isTranslated: false,
      translationStatus: TranslationStatus.READY,
    };
  }

  const sourceHash = computeSourceHash(translatableFields);

  const existingTranslation = await prisma.translation.findUnique({
    where: {
      contentType_contentId_targetLocale_sourceHash: {
        contentType,
        contentId,
        targetLocale: normalizedTarget,
        sourceHash,
      },
    },
  });

  if (
    existingTranslation &&
    existingTranslation.status === TranslationStatus.READY
  ) {
    const translatedPayload =
      existingTranslation.translatedFields as Record<string, string>;
    return {
      fields: { ...fields, ...translatedPayload } as T,
      displayedLocale: normalizedTarget,
      isTranslated: true,
      translationStatus: TranslationStatus.READY,
    };
  }

  const STALE_JOB_THRESHOLD_MS = TRANSLATION_CONFIG.STALE_JOB_THRESHOLD_MS;
  if (
    existingTranslation &&
    (existingTranslation.status === TranslationStatus.PENDING ||
      existingTranslation.status === TranslationStatus.PROCESSING)
  ) {
    const isStuck =
      Date.now() - existingTranslation.updatedAt.getTime() >
      STALE_JOB_THRESHOLD_MS;

    let jobMissing = false;
    try {
      const queue = getTranslationQueue();
      const jobId = `translate_${contentType}_${contentId}_${normalizedTarget}_${sourceHash}`;
      const existingJob = await queue.getJob(jobId);
      jobMissing = !existingJob;
    } catch {
      jobMissing = true;
    }

    if (!isStuck && !jobMissing) {
      return {
        fields: fields as T,
        displayedLocale: normalizedSource,
        isTranslated: false,
        translationStatus: existingTranslation.status,
      };
    }
  }

  if (synchronous) {
    try {
      const provider = getTranslationProvider();
      const translatedMap = await provider.translateBatch(
        translatableFields,
        normalizedSource,
        normalizedTarget
      );

      await prisma.translation.upsert({
        where: {
          contentType_contentId_targetLocale_sourceHash: {
            contentType,
            contentId,
            targetLocale: normalizedTarget,
            sourceHash,
          },
        },
        create: {
          contentType,
          contentId,
          sourceLocale: normalizedSource,
          targetLocale: normalizedTarget,
          sourceHash,
          translatedFields: translatedMap as Prisma.InputJsonValue,
          status: TranslationStatus.READY,
          provider: provider.name,
        },
        update: {
          translatedFields: translatedMap as Prisma.InputJsonValue,
          status: TranslationStatus.READY,
          provider: provider.name,
          errorMessage: null,
        },
      });

      return {
        fields: { ...fields, ...translatedMap } as T,
        displayedLocale: normalizedTarget,
        isTranslated: true,
        translationStatus: TranslationStatus.READY,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[TranslationService] Synchronous translation failed', {
        contentType,
        contentId,
        error: message,
      });
      return {
        fields: fields as T,
        displayedLocale: normalizedSource,
        isTranslated: false,
        translationStatus: TranslationStatus.FAILED,
      };
    }
  }

  try {
    await prisma.translation.upsert({
      where: {
        contentType_contentId_targetLocale_sourceHash: {
          contentType,
          contentId,
          targetLocale: normalizedTarget,
          sourceHash,
        },
      },
      create: {
        contentType,
        contentId,
        sourceLocale: normalizedSource,
        targetLocale: normalizedTarget,
        sourceHash,
        translatedFields: translatableFields as Prisma.InputJsonValue,
        status: TranslationStatus.PENDING,
      },
      update: {
        status: TranslationStatus.PENDING,
      },
    });

    const queue = getTranslationQueue();
    const jobId = `translate_${contentType}_${contentId}_${normalizedTarget}_${sourceHash}`;
    const jobPayload: ITranslationJobPayload = {
      contentType,
      contentId,
      sourceLocale: normalizedSource,
      targetLocale: normalizedTarget,
      sourceHash,
      fields: translatableFields,
    };

    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'completed' || state === 'failed') {
        await existingJob.remove();
      }
    }

    await queue.add(QUEUE_JOBS.PROCESS_TRANSLATION, jobPayload, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[TranslationService] Failed to enqueue translation job', {
      contentType,
      contentId,
      error: message,
    });
  }

  return {
    fields: fields as T,
    displayedLocale: normalizedSource,
    isTranslated: false,
    translationStatus: TranslationStatus.PENDING,
  };
};

/**
 * Deletes outdated translation rows whose source hash no longer matches.
 *
 * @param {{ contentType: string; contentId: string; currentSourceHash: string }} params - Scope.
 * @returns {Promise<void>}
 */
export const invalidateStaleTranslations = async ({
  contentType,
  contentId,
  currentSourceHash,
}: {
  contentType: string;
  contentId: string;
  currentSourceHash: string;
}): Promise<void> => {
  try {
    await prisma.translation.deleteMany({
      where: {
        contentType,
        contentId,
        sourceHash: { not: currentSourceHash },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[TranslationService] Failed to invalidate stale translations',
      { contentType, contentId, error: message }
    );
  }
};

/**
 * Pre-translates content into every **enabled** company language (except source).
 *
 * @param {{ contentType: TranslationContentType; contentId: string; sourceLocale: string; fields: Record<string, string | null | undefined> }} params - Content payload.
 * @returns {Promise<void>}
 */
export const preTranslateContent = async ({
  contentType,
  contentId,
  sourceLocale,
  fields,
}: {
  contentType: TranslationContentType;
  contentId: string;
  sourceLocale: string;
  fields: Record<string, string | null | undefined>;
}): Promise<void> => {
  const normalizedSource = (
    sourceLocale || TRANSLATION_CONFIG.DEFAULT_LOCALE
  ).toLowerCase().slice(0, 2);

  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { enabledLanguages: true, defaultLanguage: true },
  });

  const enabled = profile?.enabledLanguages?.length
    ? profile.enabledLanguages
    : [profile?.defaultLanguage ?? 'DE', 'EN'];

  const targetLocales = [
    ...new Set(
      enabled
        .map((lang) => languageToLocale(lang))
        .filter((locale) => locale !== normalizedSource)
    ),
  ];

  const sourceHash = computeSourceHash(
    Object.fromEntries(
      Object.entries(fields).filter(
        ([, v]) => typeof v === 'string' && v.trim().length > 0
      )
    ) as Record<string, string>
  );
  await invalidateStaleTranslations({
    contentType,
    contentId,
    currentSourceHash: sourceHash,
  });

  for (const targetLocale of targetLocales) {
    await getOrTranslateContent({
      contentType,
      contentId,
      sourceLocale: normalizedSource,
      targetLocale,
      fields,
      synchronous: false,
    });
  }
};
