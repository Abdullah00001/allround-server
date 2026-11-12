import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Query schema for paginated notification lists.
 */
export const getNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(DEFAULT_LIMIT)
      .optional(),
  })
  .strict();

/**
 * Path params schema for a single notification id.
 */
export const notificationIdParamSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid notification ID' }),
  })
  .strict();
