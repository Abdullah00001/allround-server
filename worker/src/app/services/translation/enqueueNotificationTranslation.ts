import crypto from 'crypto';
import { Notification, Prisma, TranslationStatus } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getTranslationQueue } from '@/app/queues/translation/translation.queue';
import { QUEUE_JOBS } from '@/const';

const DEFAULT_SOURCE_LOCALE = 'de';

/**
 * SHA-256 of non-empty string fields (stable key order; matches server).
 *
 * @param {Record<string, string>} fields - Source fields.
 * @returns {string} Hex digest.
 */
const computeSourceHash = (fields: Record<string, string>): string => {
  const sortedKeys = Object.keys(fields)
    .filter((k) => fields[k].trim().length > 0)
    .sort();
  const serialized = sortedKeys
    .map((key) => `${key}:${fields[key].trim()}`)
    .join('|');
  return crypto.createHash('sha256').update(serialized).digest('hex');
};

/**
 * Enqueues pre-translation jobs for a notification into every enabled company
 * language except the source locale (alua write-time parity).
 *
 * @param {Notification} notification - Persisted notification row.
 * @returns {Promise<void>}
 */
export const enqueueNotificationTranslations = async (
  notification: Notification
): Promise<void> => {
  const fields = {
    title: notification.title,
    message: notification.message,
  };
  if (!fields.title.trim() && !fields.message.trim()) {
    return;
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { enabledLanguages: true, defaultLanguage: true },
  });

  const sourceLocale = (
    profile?.defaultLanguage?.toLowerCase().slice(0, 2) || DEFAULT_SOURCE_LOCALE
  ).slice(0, 2);

  const enabled = profile?.enabledLanguages?.length
    ? profile.enabledLanguages
    : [profile?.defaultLanguage ?? 'DE', 'EN'];

  const targetLocales = [
    ...new Set(
      enabled
        .map((lang) => String(lang).toLowerCase().slice(0, 2))
        .filter((locale) => locale !== sourceLocale)
    ),
  ];

  if (targetLocales.length === 0) {
    return;
  }

  const sourceHash = computeSourceHash(fields);
  const queue = getTranslationQueue();

  for (const targetLocale of targetLocales) {
    try {
      await prisma.translation.upsert({
        where: {
          contentType_contentId_targetLocale_sourceHash: {
            contentType: 'NOTIFICATION',
            contentId: notification.id,
            targetLocale,
            sourceHash,
          },
        },
        create: {
          contentType: 'NOTIFICATION',
          contentId: notification.id,
          sourceLocale,
          targetLocale,
          sourceHash,
          translatedFields: fields as Prisma.InputJsonValue,
          status: TranslationStatus.PENDING,
        },
        update: {
          status: TranslationStatus.PENDING,
          sourceLocale,
        },
      });

      const jobId = `translate_NOTIFICATION_${notification.id}_${targetLocale}_${sourceHash}`;
      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'completed' || state === 'failed') {
          await existingJob.remove();
        }
      }

      await queue.add(
        QUEUE_JOBS.PROCESS_TRANSLATION,
        {
          contentType: 'NOTIFICATION',
          contentId: notification.id,
          sourceLocale,
          targetLocale,
          sourceHash,
          fields,
        },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100, age: 24 * 3600 },
          removeOnFail: { count: 500, age: 7 * 24 * 3600 },
        }
      );
    } catch (error) {
      logger.error(
        `[enqueueNotificationTranslations] Failed for ${notification.id} → ${targetLocale}`,
        { error }
      );
    }
  }
};
