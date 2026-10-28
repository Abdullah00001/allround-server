import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import prisma from '@/app/configs/db.configs';
import { SOCKET_EVENTS } from '@/const';
import { validateSocketPayload } from '@/app/utils/system.utils';
import {
  readMessageSchema,
  typingSchema,
  ReadMessagePayload,
  TypingPayload,
} from '@/app/sockets/schemas/chat.schemas';
import { isConversationParticipant } from '@/app/sockets/helpers/chat.helpers';

export const handleMessageRead = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
    return;
  }

  const validated = validateSocketPayload(data, readMessageSchema);
  if (!validated.data) {
    socket.emit(SOCKET_EVENTS.MESSAGE_ERROR, { error: 'invalid_payload' });
    return;
  }

  const { conversationId } = validated.data as ReadMessagePayload;

  if (!(await isConversationParticipant(conversationId, userId))) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not a participant' });
    return;
  }

  const now = new Date();
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    data: {
      unreadCount: 0,
      lastReadAt: now,
    },
  });

  socket
    .to(`conversation:${conversationId}`)
    .emit(SOCKET_EVENTS.MESSAGE_READ_RESPONSE, {
      conversationId,
      userId,
      lastReadAt: now,
    });
};

export const handleTypingStart = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) return;

  const validated = validateSocketPayload(data, typingSchema);
  if (!validated.data) return;

  const { conversationId } = validated.data as TypingPayload;

  if (!(await isConversationParticipant(conversationId, userId))) return;

  socket
    .to(`conversation:${conversationId}`)
    .emit(SOCKET_EVENTS.TYPING_START_RESPONSE, {
      userId,
      conversationId,
      name: socket.user?.fullName || null,
      avatar: socket.user?.avatarUrl || null,
    });
};

export const handleTypingStop = async (
  socket: AuthenticatedSocket,
  data: unknown
): Promise<void> => {
  const userId = socket.user?.id;
  if (!userId) return;

  const validated = validateSocketPayload(data, typingSchema);
  if (!validated.data) return;

  const { conversationId } = validated.data as TypingPayload;

  if (!(await isConversationParticipant(conversationId, userId))) return;

  socket
    .to(`conversation:${conversationId}`)
    .emit(SOCKET_EVENTS.TYPING_STOP_RESPONSE, {
      userId,
      conversationId,
      name: socket.user?.fullName || null,
      avatar: socket.user?.avatarUrl || null,
    });
};
