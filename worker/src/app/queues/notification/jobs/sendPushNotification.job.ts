import { Job } from 'bullmq';
import { DeviceStatus, Notification, RevokeReason } from '@prisma/client';
import { IJobHandler } from '@/app/@types/queue.types';
import { ISendPushNotification } from '@/app/queues/notification/notification.types';
import { QUEUE_JOBS, SOCKET_EVENTS } from '@/const';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getFirebaseMessaging } from '@/app/configs/firebase.configs';
import { emitToUserNotificationRoom } from '@/app/configs/socketEmitter.configs';
import { enqueueNotificationTranslations } from '@/app/services/translation/enqueueNotificationTranslation';
import { resolveNotificationLocaleCopy } from '@/app/services/translation/resolveNotificationLocaleCopy';

/**
 * Builds the real-time payload emitted to connected Socket.IO clients.
 *
 * @param {Notification} notification - Persisted notification row.
 * @param {string} title - Locale-resolved title.
 * @param {string} message - Locale-resolved body.
 * @returns {object} Client-facing notification payload.
 */
const buildNotificationSocketPayload = (
  notification: Notification,
  title: string,
  message: string
) => ({
  id: notification.id,
  type: notification.type,
  title,
  message,
  link: notification.link,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
});

/**
 * Emits `notification:new` and unread count with locale-resolved copy.
 *
 * @param {Notification} notification - Persisted notification row.
 * @param {string} title - Localized title.
 * @param {string} message - Localized body.
 * @returns {Promise<void>}
 */
const emitRealtimeNotification = async (
  notification: Notification,
  title: string,
  message: string
): Promise<void> => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: notification.userId, isRead: false },
    });

    emitToUserNotificationRoom(
      notification.userId,
      SOCKET_EVENTS.NOTIFICATION_NEW,
      buildNotificationSocketPayload(notification, title, message)
    );
    emitToUserNotificationRoom(
      notification.userId,
      SOCKET_EVENTS.NOTIFICATION_COUNT_RESPONSE,
      { count: unreadCount }
    );
  } catch (error) {
    logger.error(
      `[sendPushNotification] Failed to emit socket event for user ${notification.userId}`,
      { error }
    );
  }
};

/**
 * Sends one FCM multicast for a token group with the given title/body.
 *
 * @param {object} params - Tokens + copy + type.
 * @returns {Promise<string[]>} Invalid FCM tokens to revoke.
 */
const sendFcmMulticast = async ({
  tokens,
  title,
  body,
  type,
}: {
  tokens: string[];
  title: string;
  body: string;
  type: string;
}): Promise<string[]> => {
  if (tokens.length === 0) return [];

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    logger.info(
      `[sendPushNotification] Firebase not initialized; stubbed push "${title}" to ${tokens.length} tokens`
    );
    return [];
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      title: String(title),
      body: String(body),
      message: String(body),
      type: String(type),
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    android: {
      priority: 'high',
      notification: {
        title,
        body,
        channelId: 'high_importance_channel',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
    },
  });

  logger.info(
    `[sendPushNotification] FCM multicast: ${response.successCount} ok, ${response.failureCount} failed (${tokens.length} tokens)`
  );

  const invalidTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    if (!res.success && res.error) {
      const errorCode = res.error.code;
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });
  return invalidTokens;
};

/**
 * Persists in-app notifications (source locale), pre-translates all enabled
 * languages, emits Socket.IO + FCM in each recipient's preferred language.
 */
const handler: IJobHandler<ISendPushNotification> = {
  name: QUEUE_JOBS.SEND_PUSH_NOTIFICATION,
  handler: async (data: ISendPushNotification, job: Job) => {
    const { userIds, title, body, type } = data;

    if (!userIds || userIds.length === 0) {
      return;
    }

    try {
      const profile = await prisma.companyProfile.findUnique({
        where: { id: 'global' },
        select: { defaultLanguage: true },
      });
      const sourceLocale = (profile?.defaultLanguage ?? 'DE')
        .toLowerCase()
        .slice(0, 2);

      const notifications = await prisma.$transaction(
        userIds.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              type,
              title,
              message: body,
              isRead: false,
            },
          })
        )
      );

      const preferences = await prisma.userPreference.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, language: true },
      });
      const languageByUser = new Map(
        preferences.map((row) => [
          row.userId,
          row.language.toLowerCase().slice(0, 2),
        ])
      );

      const copyByNotificationId = new Map<
        string,
        { title: string; body: string; locale: string }
      >();

      await Promise.all(
        notifications.map(async (notification) => {
          await enqueueNotificationTranslations(notification);

          const preferred =
            languageByUser.get(notification.userId) ?? sourceLocale;
          const localized = await resolveNotificationLocaleCopy({
            notificationId: notification.id,
            title,
            body,
            targetLocale: preferred,
            sourceLocale,
          });
          copyByNotificationId.set(notification.id, localized);

          await emitRealtimeNotification(
            notification,
            localized.title,
            localized.body
          );
        })
      );

      const devices = await prisma.device.findMany({
        where: {
          userId: { in: userIds },
          status: DeviceStatus.ACTIVE,
          fcmToken: { not: null },
        },
        select: {
          id: true,
          userId: true,
          fcmToken: true,
        },
      });

      if (devices.length === 0) {
        return;
      }

      /** Group FCM tokens by resolved locale so each language gets correct copy. */
      const tokensByLocale = new Map<string, string[]>();
      const copyByLocale = new Map<string, { title: string; body: string }>();

      for (const device of devices) {
        if (!device.fcmToken) continue;
        const notification = notifications.find(
          (row) => row.userId === device.userId
        );
        const localized = notification
          ? copyByNotificationId.get(notification.id)
          : null;
        const locale = localized?.locale ?? sourceLocale;
        const localizedTitle = localized?.title ?? title;
        const localizedBody = localized?.body ?? body;

        if (!copyByLocale.has(locale)) {
          copyByLocale.set(locale, {
            title: localizedTitle,
            body: localizedBody,
          });
        }
        const list = tokensByLocale.get(locale) ?? [];
        list.push(device.fcmToken);
        tokensByLocale.set(locale, list);
      }

      const invalidTokens: string[] = [];
      for (const [locale, tokens] of tokensByLocale) {
        const copy = copyByLocale.get(locale) ?? { title, body };
        const invalid = await sendFcmMulticast({
          tokens,
          title: copy.title,
          body: copy.body,
          type: String(type),
        });
        invalidTokens.push(...invalid);
      }

      if (invalidTokens.length > 0) {
        await prisma.device.updateMany({
          where: { fcmToken: { in: invalidTokens } },
          data: {
            status: DeviceStatus.REVOKED,
            fcmToken: null,
            revokeReason: RevokeReason.FCM_INVALID_TOKEN,
          },
        });
        logger.info(
          `[sendPushNotification] Revoked ${invalidTokens.length} invalid FCM tokens`
        );
      }
    } catch (error) {
      logger.error(`[${job.name}] Job failed`, { jobId: job.id, error });
      throw error;
    }
  },
};

export default handler;
