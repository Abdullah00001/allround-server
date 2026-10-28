import prisma from '@/app/configs/db.configs';

export async function isConversationParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return Boolean(participant);
}

export async function getConversation(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
}
