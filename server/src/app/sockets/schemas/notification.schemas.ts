import { z } from 'zod';

export const notificationMarkReadSchema = z.object({
  notificationId: z.string().uuid({ error: 'Invalid notification ID' }),
});

export const notificationMarkAllReadSchema = z.object({});

export type NotificationMarkReadPayload = z.infer<
  typeof notificationMarkReadSchema
>;
export type NotificationMarkAllReadPayload = z.infer<
  typeof notificationMarkAllReadSchema
>;
