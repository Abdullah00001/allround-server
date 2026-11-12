import { NotificationType } from '@prisma/client';

/**
 * BullMQ payload for `send-push-notification`.
 * Title/body are already localized by the producer for this recipient cohort.
 */
export interface ISendPushNotification {
  /** Recipient user UUIDs sharing the same localized title/body. */
  userIds: string[];
  /** Prisma notification category. */
  type: NotificationType;
  /** Localized push/in-app title. */
  title: string;
  /** Localized push/in-app body. */
  body: string;
}
