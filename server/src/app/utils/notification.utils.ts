import { NotificationType } from '@prisma/client';
import { getNotificationQueue } from '@/app/queues/notification/notification.queue';
import { QUEUE_JOBS } from '@/const';

export interface ITriggerPushNotificationPayload {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Dispatches a push notification job to the notification BullMQ queue.
 *
 * @param payload - Recipient user IDs, notification type, title, and body.
 */
export const triggerPushNotification = async (
  payload: ITriggerPushNotificationPayload
): Promise<void> => {
  if (!payload.userIds || payload.userIds.length === 0) {
    return;
  }

  const queue = getNotificationQueue();
  await queue.add(QUEUE_JOBS.SEND_PUSH_NOTIFICATION, payload);
};
