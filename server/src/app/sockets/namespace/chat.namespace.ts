import { Namespace } from 'socket.io';
import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import logger from '@/app/configs/logger.configs';
import registerHandler from '@/app/sockets/helpers/registerHandler.helper';
import { chatEventRegistry } from '@/app/sockets/events/chat.events';
import { globalSocketErrorMiddleware } from '@/app/middlewares/socket.middlewares';
import prisma from '@/app/configs/db.configs';

const chatNamespace = (chat: Namespace): void => {
  chat.on('connection', async (socket) => {
    const user = socket as AuthenticatedSocket;
    const userId = user.user?.id;
    logger.info(`Chat Namespace Connected: ${user.id} | userId: ${userId}`);

    if (userId) {
      socket.join(`user:${userId}`);

      try {
        const participants = await prisma.conversationParticipant.findMany({
          where: { userId },
          select: { conversationId: true },
        });

        for (const p of participants) {
          socket.join(`conversation:${p.conversationId}`);
        }

        logger.debug(
          `User ${userId} auto-joined ${participants.length} conversations`
        );
      } catch (err) {
        logger.error(`Error auto-joining conversations for user ${userId}:`, err);
      }
    }

    socket.on('error', (err) => {
      globalSocketErrorMiddleware(err, user);
    });

    registerHandler({ socket, events: chatEventRegistry });

    socket.on('disconnect', (reason) => {
      logger.info(
        `Chat Namespace Disconnected: ${user.id} | reason: ${reason}`
      );
    });
  });
};

export default chatNamespace;
