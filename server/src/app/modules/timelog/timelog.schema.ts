import { ActivityType, TimeLogStatus } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Admin list status filter (excludes REJECTED from the filter enum by product request).
 */
const listTimeLogStatusSchema = z.enum([
  TimeLogStatus.PENDING_APPROVAL,
  TimeLogStatus.APPROVED,
]);

/**
 * Query schema for `GET /admin/time-logs`.
 * Supports pagination, project/user/status filters, and an optional startTime range.
 */
export const getTimeLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    projectId: z.string().uuid({ error: 'Invalid project id' }).optional(),
    userId: z.string().uuid({ error: 'Invalid user id' }).optional(),
    status: listTimeLogStatusSchema.optional(),
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
 * Path params schema for routes targeting a single time log by UUID.
 */
export const timeLogIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid time log id' }),
  })
  .strict();

/**
 * Request body schema for `POST /admin/time-logs` (manual admin entry).
 */
export const createTimeLogSchema = z
  .object({
    userId: z.string().uuid({ error: 'Invalid user id' }),
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, {
      message: 'Invalid activity type',
    }),
    startTime: z.coerce.date({ error: 'Invalid start time' }),
    endTime: z.coerce.date({ error: 'Invalid end time' }),
    breakMinutes: z.number().int().min(0).default(0),
  })
  .strict()
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

/**
 * Request body schema for `PATCH /admin/time-logs/:id`.
 * All fields optional; `reason` is required by middleware when company
 * setting `requireReasonForTimeEdit` is enabled.
 */
export const updateTimeLogSchema = z
  .object({
    activityType: z
      .enum(ActivityType, { message: 'Invalid activity type' })
      .optional(),
    startTime: z.coerce.date({ error: 'Invalid start time' }).optional(),
    endTime: z.coerce.date({ error: 'Invalid end time' }).optional(),
    breakMinutes: z.number().int().min(0).optional(),
    reason: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.startTime === undefined ||
      data.endTime === undefined ||
      data.endTime.getTime() > data.startTime.getTime(),
    {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    }
  );
