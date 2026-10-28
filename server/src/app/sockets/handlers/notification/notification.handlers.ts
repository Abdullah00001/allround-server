import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import prisma from '@/app/configs/db.configs';
import { SOCKET_EVENTS } from '@/const';
import { validateSocketPayload } from '@/app/utils/system.utils';
import {
  notificationMarkReadSchema,
  NotificationMarkReadPayload,
} from '@/app/sockets/schemas/notification.schemas';
import logger from '@/app/configs/logger.configs';

export const handleNotificationCount = async (
  socket: AuthenticatedSocket,
  _data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) return;

  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    socket.emit(SOCKET_EVENTS.NOTIFICATION_COUNT_RESPONSE, { count });
    logger.debug(`[Socket] Notification count for user ${userId}: ${count}`);
  } catch (error) {
    logger.error(
      `[Socket] Error getting notification count for user ${userId}:`,
      error
    );
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Failed to get notification count',
    });
  }
};

export const handleNotificationMarkRead = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
    return;
  }

  const validated = validateSocketPayload(data, notificationMarkReadSchema);
  if (!validated.data) {
    socket.emit(SOCKET_EVENTS.MESSAGE_ERROR, {
      error: 'invalid_payload',
      details: validated.error,
    });
    return;
  }

  const { notificationId } = validated.data as NotificationMarkReadPayload;

  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Notification not found or already read',
      });
      return;
    }

    socket.emit(SOCKET_EVENTS.NOTIFICATION_READ, { notificationId });

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    socket.emit(SOCKET_EVENTS.NOTIFICATION_COUNT_RESPONSE, { count });

    logger.debug(
      `[Socket] Notification ${notificationId} marked as read for user ${userId}`
    );
  } catch (error) {
    logger.error(
      `[Socket] Error marking notification ${notificationId} as read:`,
      error
    );
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Failed to mark notification as read',
    });
  }
};

export const handleNotificationMarkAllRead = async (
  socket: AuthenticatedSocket,
  _data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
    return;
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    socket.emit(SOCKET_EVENTS.NOTIFICATION_ALL_READ, {
      count: result.count,
    });

    socket.emit(SOCKET_EVENTS.NOTIFICATION_COUNT_RESPONSE, { count: 0 });

    logger.debug(
      `[Socket] All notifications marked as read for user ${userId} (${result.count} notifications)`
    );
  } catch (error) {
    logger.error(
      `[Socket] Error marking all notifications as read for user ${userId}:`,
      error
    );
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Failed to mark all notifications as read',
    });
  }
};
