import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import logger from '@/app/configs/logger.configs';
import registerHandler from '@/app/sockets/helpers/registerHandler.helper';
import { notificationEventRegistry } from '@/app/sockets/events/notification.events';
import { globalSocketErrorMiddleware } from '@/app/middlewares/socket.middlewares';
import prisma from '@/app/configs/db.configs';
import { SOCKET_EVENTS } from '@/const';

const notificationNamespace = (notification: Namespace): void => {
  notification.on('connection', async (socket) => {
    const user = socket as AuthenticatedSocket;
    const userId = user.user?.id;
    logger.info(
      `Notification Namespace Connected: ${user.id} | userId: ${userId}`
    );

    if (userId) {
      socket.join(`user:${userId}`);
      try {
        const count = await prisma.notification.count({
          where: { userId, isRead: false },
        });
        socket.emit(SOCKET_EVENTS.NOTIFICATION_COUNT_RESPONSE, { count });
      } catch (err) {
        logger.error(
          `Error fetching notification count for user ${userId}:`,
          err
        );
      }
    }

    socket.on('error', (err) => {
      globalSocketErrorMiddleware(err, user);
    });

    registerHandler({ socket, events: notificationEventRegistry });

    socket.on('disconnect', (reason) => {
      logger.info(
        `Notification Namespace Disconnected: ${user.id} | reason: ${reason}`
      );
    });
  });
};

export default notificationNamespace;
