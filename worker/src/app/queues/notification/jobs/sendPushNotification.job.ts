import { Job } from 'bullmq';
import { DeviceStatus, RevokeReason } from '@prisma/client';
import { IJobHandler } from '@/app/@types/queue.types';
import { ISendPushNotification } from '@/app/queues/notification/notification.types';
import { QUEUE_JOBS } from '@/const';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getFirebaseMessaging } from '@/app/configs/firebase.configs';

/**
 * Persists in-app notifications and delivers FCM multicast pushes.
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
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type,
          title,
          message: body,
          isRead: false,
        })),
      });

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
