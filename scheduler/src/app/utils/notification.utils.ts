import { Language, NotificationType } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getNotificationQueue } from '@/app/queues/notification/notification.queue';
import { t, TranslationKey } from '@/app/i18n';
import { QUEUE_JOBS } from '@/const';

/**
 * Resolves the company-wide default language, falling back to `EN`.
 *
 * @returns {Promise<Language>} Default language code.
 */
const getCompanyDefaultLanguage = async (): Promise<Language> => {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { defaultLanguage: true },
  });
  return profile?.defaultLanguage ?? Language.EN;
};

/**
 * Localizes a push notification per recipient language, groups users by
 * rendered copy, and enqueues one BullMQ job per language cohort.
 * Redis/enqueue failures are logged and never thrown.
 *
 * @param {string[]} userIds - Recipient user UUIDs.
 * @param {NotificationType} type - Prisma notification category.
 * @param {TranslationKey} titleKey - i18n title key.
 * @param {TranslationKey} bodyKey - i18n body key.
 * @param {Record<string, string | number>} [params] - Interpolation params.
 * @returns {Promise<void>}
 */
export const triggerPushNotification = async (
  userIds: string[],
  type: NotificationType,
  titleKey: TranslationKey,
  bodyKey: TranslationKey,
  params?: Record<string, string | number>
): Promise<void> => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  try {
    const defaultLanguage = await getCompanyDefaultLanguage();

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds }, deletedAt: null },
      select: {
        id: true,
        preferences: { select: { language: true } },
      },
    });

    const cohorts = new Map<
      string,
      { title: string; body: string; userIds: string[] }
    >();

    for (const user of users) {
      const language =
        user.preferences?.language ?? defaultLanguage ?? Language.EN;
      const locale = language.toLowerCase();
      const title = t(titleKey, locale, params);
      const body = t(bodyKey, locale, params);
      const cohortKey = `${locale}::${title}::${body}`;

      const existing = cohorts.get(cohortKey);
      if (existing) {
        existing.userIds.push(user.id);
      } else {
        cohorts.set(cohortKey, { title, body, userIds: [user.id] });
      }
    }

    if (cohorts.size === 0) return;

    const queue = getNotificationQueue();
    await Promise.all(
      [...cohorts.values()].map((cohort) =>
        queue.add(QUEUE_JOBS.SEND_PUSH_NOTIFICATION, {
          userIds: cohort.userIds,
          type,
          title: cohort.title,
          body: cohort.body,
        })
      )
    );
  } catch (error) {
    logger.error('[triggerPushNotification] Failed to enqueue push job', {
      userIds: uniqueUserIds,
      type,
      titleKey,
      bodyKey,
      error,
    });
  }
};
