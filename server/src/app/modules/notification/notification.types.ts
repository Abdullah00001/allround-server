import { z } from 'zod';
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from '@/app/modules/notification/notification.schema';

export type TGetNotificationsQuery = z.infer<
  typeof getNotificationsQuerySchema
>;
export type TNotificationIdParam = z.infer<typeof notificationIdParamSchema>;

/**
 * Service input for listing a user's notifications.
 */
export interface IGetNotificationsParams {
  userId: string;
  page?: number;
  limit?: number;
}

/**
 * Service input for marking one notification as read.
 */
export interface IMarkAsReadParams {
  userId: string;
  notificationId: string;
}

/**
 * Service input for marking all notifications as read.
 */
export interface IMarkAllAsReadParams {
  userId: string;
}
