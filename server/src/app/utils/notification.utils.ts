import { Language, NotificationType } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getNotificationQueue } from '@/app/queues/notification/notification.queue';
import { t, TranslationKey } from '@/app/i18n';
import { QUEUE_JOBS, TRANSLATION_CONFIG } from '@/const';

/**
 * Alua-compatible raw push payload (literal title/body, no i18n keys).
 * Title/body should be in the company source locale (`TRANSLATION_CONFIG.DEFAULT_LOCALE`).
 */
export type TTriggerRawPushNotificationPayload = {
  /** Recipient user UUIDs. */
  userIds: string[];
  /** Prisma notification category. */
  type: NotificationType;
  /** Push / in-app title (source locale). */
  title: string;
  /** Push / in-app body (source locale). */
  body: string;
};

/**
 * Resolves the company-wide default language, falling back to config default.
 *
 * @returns {Promise<Language>} Default language code.
 */
const getCompanyDefaultLanguage = async (): Promise<Language> => {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { defaultLanguage: true },
  });
  return (
    profile?.defaultLanguage ??
    (TRANSLATION_CONFIG.DEFAULT_LOCALE.toUpperCase() as Language)
  );
};

/**
 * Enqueues a push/in-app notification with literal title/body (alua-compatible).
 * Stored copy is treated as source locale; clients localize via GET /notifications.
 * Failures are logged, never thrown.
 *
 * @param {TTriggerRawPushNotificationPayload} payload - Recipients + copy.
 * @returns {Promise<void>}
 */
export const triggerRawPushNotification = async (
  payload: TTriggerRawPushNotificationPayload
): Promise<void> => {
  const uniqueUserIds = [...new Set((payload.userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  try {
    const queue = getNotificationQueue();
    await queue.add(QUEUE_JOBS.SEND_PUSH_NOTIFICATION, {
      userIds: uniqueUserIds,
      type: payload.type,
      title: payload.title,
      body: payload.body,
    });
  } catch (error) {
    logger.error('[triggerRawPushNotification] Failed to enqueue push job', {
      userIds: uniqueUserIds,
      type: payload.type,
      error,
    });
  }
};

/**
 * Renders notification copy in the company default (source) locale and enqueues
 * one BullMQ job for all recipients (alua read-time Translation parity).
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
    const locale = defaultLanguage.toLowerCase().slice(0, 2);
    const title = t(titleKey, locale, params);
    const body = t(bodyKey, locale, params);

    const queue = getNotificationQueue();
    await queue.add(QUEUE_JOBS.SEND_PUSH_NOTIFICATION, {
      userIds: uniqueUserIds,
      type,
      title,
      body,
    });
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
