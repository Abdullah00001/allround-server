import { Job } from 'bullmq';
import { DeviceStatus, Notification, RevokeReason } from '@prisma/client';
import { IJobHandler } from '@/app/@types/queue.types';
import { ISendPushNotification } from '@/app/queues/notification/notification.types';
import { QUEUE_JOBS, SOCKET_EVENTS } from '@/const';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getFirebaseMessaging } from '@/app/configs/firebase.configs';
import { emitToUserNotificationRoom } from '@/app/configs/socketEmitter.configs';

/**
 * Builds the real-time payload emitted to connected Socket.IO clients.
 *
 * @param {Notification} notification - Persisted notification row.
 * @returns {object} Client-facing notification payload.
 */
const buildNotificationSocketPayload = (notification: Notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  link: notification.link,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
});

/**
 * Emits `notification:new` and an updated unread count to a user's room.
 *
 * @param {Notification} notification - Persisted notification row.
 * @returns {Promise<void>}
 */
const emitRealtimeNotification = async (
  notification: Notification
): Promise<void> => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: notification.userId, isRead: false },
    });

    emitToUserNotificationRoom(
      notification.userId,
      SOCKET_EVENTS.NOTIFICATION_NEW,
      buildNotificationSocketPayload(notification)
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
 * Persists in-app notifications, emits Socket.IO events via Redis, and delivers FCM.
 * Revokes device rows whose FCM tokens are invalid/unregistered.
 */
const handler: IJobHandler<ISendPushNotification> = {
  name: QUEUE_JOBS.SEND_PUSH_NOTIFICATION,
  handler: async (data: ISendPushNotification, job: Job) => {
    const { userIds, title, body, type } = data;

    if (!userIds || userIds.length === 0) {
      return;
    }

    try {
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

      await Promise.all(
        notifications.map((notification) =>
          emitRealtimeNotification(notification)
        )
      );

      const devices = await prisma.device.findMany({
        where: {
          userId: { in: userIds },
          status: DeviceStatus.ACTIVE,
          fcmToken: { not: null },
        },
        select: {
          id: true,
          fcmToken: true,
        },
      });

      const fcmTokens = devices
        .map((device) => device.fcmToken)
        .filter((token): token is string => Boolean(token));

      if (fcmTokens.length === 0) {
        return;
      }

      const messaging = getFirebaseMessaging();
      if (!messaging) {
        logger.info(
          `[sendPushNotification] Firebase not initialized; stubbed push "${title}" to ${fcmTokens.length} tokens`
        );
        return;
      }

      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
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
        `[sendPushNotification] FCM multicast: ${response.successCount} ok, ${response.failureCount} failed (${fcmTokens.length} tokens)`
      );

      const invalidTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const errorCode = res.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(fcmTokens[idx]);
          }
        }
      });

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
