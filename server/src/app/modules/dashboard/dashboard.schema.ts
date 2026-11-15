import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Query schema for `GET /admin/dashboard`.
 * Paginates `todaysOperations` only; stats and map pins are full-set.
 */
export const getAdminDashboardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
  })
  .strict();
