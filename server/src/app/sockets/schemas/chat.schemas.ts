import { z } from 'zod';

export const conversationIdSchema = z.object({
  conversationId: z.string().uuid({ error: 'Invalid conversation ID' }),
});

export const typingSchema = z.object({
  conversationId: z.string().uuid({ error: 'Invalid conversation ID' }),
});

export const readMessageSchema = z.object({
  conversationId: z.string().uuid({ error: 'Invalid conversation ID' }),
});

export type ConversationIdPayload = z.infer<typeof conversationIdSchema>;
export type TypingPayload = z.infer<typeof typingSchema>;
export type ReadMessagePayload = z.infer<typeof readMessageSchema>;
