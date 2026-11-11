import { AbsenceType } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Query schema for `GET /admin/absences`.
 * Supports pagination, user filter, and optional overlapping date range.
 */
export const getAbsencesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    userId: z.string().uuid({ error: 'Invalid user id' }).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.startDate === undefined ||
      data.endDate === undefined ||
      data.startDate.getTime() <= data.endDate.getTime(),
    { message: 'startDate must be before or equal to endDate' }
  );

/**
 * Path params schema for routes targeting a single absence by UUID.
 */
export const absenceIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid absence id' }),
  })
  .strict();

/**
 * Request body schema for `POST /admin/absences`.
 * Enforces `startDate` before `endDate`.
 */
export const createAbsenceSchema = z
  .object({
    userId: z.string().uuid({ error: 'Invalid user id' }),
    type: z.enum(AbsenceType, { message: 'Invalid absence type' }),
    startDate: z.coerce.date({ error: 'Invalid start date' }),
    endDate: z.coerce.date({ error: 'Invalid end date' }),
    note: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((data) => data.startDate.getTime() < data.endDate.getTime(), {
    message: 'startDate must be before endDate',
    path: ['endDate'],
  });
