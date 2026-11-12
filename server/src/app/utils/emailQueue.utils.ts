import { Language, User } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getEmailQueue } from '@/app/queues/email/email.queue';

/**
 * Resolves language for email payloads:
 * user preference → company default → `EN`.
 *
 * @param {Pick<User, 'id'> | null | undefined} user - Optional user with id.
 * @returns {Promise<string>} Language code string.
 */
export const resolveEmailLanguage = async (
  user?: Pick<User, 'id'> | null
): Promise<string> => {
  if (user?.id) {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: user.id },
      select: { language: true },
    });
    if (preferences?.language) return preferences.language;
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { defaultLanguage: true },
  });

  return profile?.defaultLanguage ?? Language.EN;
};

/**
 * Enqueues an email job without failing the caller when Redis blips.
 *
 * @param {string} jobName - BullMQ job name from `QUEUE_JOBS`.
 * @param {Record<string, unknown>} payload - Job payload (should include language).
 * @returns {Promise<void>}
 */
export const enqueueEmailJob = async (
  jobName: string,
  payload: Record<string, unknown>
): Promise<void> => {
  try {
    const emailQueue = getEmailQueue();
    await emailQueue.add(jobName, payload);
  } catch (error) {
    logger.error('[enqueueEmailJob] Failed to enqueue email job', {
      jobName,
      error,
    });
  }
};
