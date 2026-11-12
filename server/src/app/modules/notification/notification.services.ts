import { Notification } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { NotificationDTO } from '@/app/modules/notification/notification.dto';
import {
  IGetNotificationsParams,
  IMarkAllAsReadParams,
} from '@/app/modules/notification/notification.types';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Lists paginated notifications for a user and the current unread count.
 *
 * @param {IGetNotificationsParams} params - User id and optional pagination.
 * @returns {Promise<{ data: NotificationDTO[]; total: number; page: number; limit: number; unreadCount: number }>}
 */
export const getNotificationsService = async ({
  userId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
}: IGetNotificationsParams): Promise<{
  data: NotificationDTO[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}> => {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    data: notifications.map((notification) =>
      NotificationDTO.build(notification)
    ),
    total,
    page,
    limit,
    unreadCount,
  };
};

/**
 * Marks a single owned notification as read.
 *
 * @param {IMarkAsReadParams} params - User id and notification id.
 * @param {Notification} notification - Trusted notification from middleware.
 * @returns {Promise<{ id: string; isRead: boolean }>}
 */
export const markAsReadService = async ({
  notification,
}: {
  notification: Notification;
}): Promise<{ id: string; isRead: boolean }> => {
  if (notification.isRead) {
    return { id: notification.id, isRead: true };
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  return { id: notification.id, isRead: true };
};

/**
 * Marks all unread notifications for a user as read.
 *
 * @param {IMarkAllAsReadParams} params - User id.
 * @returns {Promise<{ updatedCount: number }>}
 */
export const markAllAsReadService = async ({
  userId,
}: IMarkAllAsReadParams): Promise<{ updatedCount: number }> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return { updatedCount: result.count };
};
