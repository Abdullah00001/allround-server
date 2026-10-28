import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import prisma from '@/app/configs/db.configs';
import { SOCKET_EVENTS } from '@/const';
import { validateSocketPayload } from '@/app/utils/system.utils';
import {
  conversationIdSchema,
  ConversationIdPayload,
} from '@/app/sockets/schemas/chat.schemas';
import { isConversationParticipant } from '@/app/sockets/helpers/chat.helpers';
import logger from '@/app/configs/logger.configs';

export const handleConversationJoin = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
    return;
  }

  const validated = validateSocketPayload(data, conversationIdSchema);
  if (!validated.data) {
    socket.emit(SOCKET_EVENTS.MESSAGE_ERROR, {
      error: 'invalid_payload',
      details: validated.error,
    });
    return;
  }

  const { conversationId } = validated.data as ConversationIdPayload;

  if (!(await isConversationParticipant(conversationId, userId))) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'You are not a participant of this conversation',
    });
    return;
  }

  const now = new Date();
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: now, unreadCount: 0 },
  });

  socket.join(`conversation:${conversationId}`);
  socket.emit(SOCKET_EVENTS.CONVERSATION_JOINED, { conversationId });

  socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_READ_RESPONSE, {
    conversationId,
    userId,
    lastReadAt: now,
  });

  logger.debug(`User ${userId} joined conversation ${conversationId}`);
};

export const handleConversationLeave = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
    return;
  }

  const validated = validateSocketPayload(data, conversationIdSchema);
  if (!validated.data) {
    socket.emit(SOCKET_EVENTS.MESSAGE_ERROR, {
      error: 'invalid_payload',
      details: validated.error,
    });
    return;
  }

  const { conversationId } = validated.data as ConversationIdPayload;

  socket.leave(`conversation:${conversationId}`);
  socket.emit(SOCKET_EVENTS.CONVERSATION_LEFT, { conversationId });

  logger.debug(`User ${userId} left conversation ${conversationId}`);
};
