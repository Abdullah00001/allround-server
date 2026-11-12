import { ActivityType, PhaseStatus, PhaseType } from '@prisma/client';
import { z } from 'zod';

/**
 * Request body schema for `POST /mobile/timer/start`.
 */
export const startTimerSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
    gpsStartLat: z.number().min(-90).max(90).optional(),
    gpsStartLng: z.number().min(-180).max(180).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /mobile/timer/stop`.
 */
export const stopTimerSchema = z
  .object({
    timeLogId: z.string().uuid({ error: 'Invalid time log id' }),
    gpsEndLat: z.number().min(-90).max(90).optional(),
    gpsEndLng: z.number().min(-180).max(180).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /mobile/timer/manual`.
 */
export const manualTimeSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
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
 * Single offline sync log entry.
 */
const syncTimeLogItemSchema = z
  .object({
    clientSyncId: z.string().trim().min(1, { message: 'clientSyncId is required' }),
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
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
 * Request body schema for `POST /mobile/sync`.
 */
export const syncTimeLogsSchema = z
  .object({
    logs: z.array(syncTimeLogItemSchema).min(1, {
      message: 'At least one log is required',
    }),
  })
  .strict();

/**
 * Query schema for `GET /mobile/time-logs`.
 * Filters the authenticated user's logs to today, this week, or this month (UTC).
 */
export const getMyTimeLogsQuerySchema = z
  .object({
    period: z.enum(['TODAY', 'WEEK', 'MONTH']).default('TODAY'),
  })
  .strict();

/**
 * Query schema for `GET /mobile/schedule`.
 * Inclusive calendar window used to find overlapping scheduled phases.
 */
export const getScheduleQuerySchema = z
  .object({
    startDate: z.coerce.date({ error: 'Invalid startDate' }),
    endDate: z.coerce.date({ error: 'Invalid endDate' }),
  })
  .strict()
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

/**
 * Query schema for `GET /mobile/map`.
 * Optional phase-type filter for map pins.
 */
export const getMapQuerySchema = z
  .object({
    type: z.enum(PhaseType, { message: 'Invalid phase type' }).optional(),
  })
  .strict();

/**
 * Query schema for `GET /mobile/crew-time`.
 * Project-scoped crew aggregation with optional UTC calendar-day filter.
 */
export const getCrewTimeQuerySchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    date: z.coerce.date({ error: 'Invalid date' }).optional(),
  })
  .strict();

/**
 * Path params schema for mobile inspection `/:id` routes.
 */
export const mobileInspectionIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid inspection id' }),
  })
  .strict();

/**
 * Path params schema for `PATCH /mobile/phases/:id/status`.
 */
export const mobilePhaseIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();

/**
 * Request body schema for `PATCH /mobile/inspections/:id/complete`.
 * Saves survey scaffold specs and marks the inspection `SURVEY_DONE`.
 */
export const completeInspectionSchema = z
  .object({
    scaffoldArea: z.number().positive({ message: 'Scaffold area must be positive' }),
    scaffoldHeight: z
      .number()
      .positive({ message: 'Scaffold height must be positive' }),
    scaffoldType: z.string().trim().min(1, { message: 'Scaffold type is required' }),
  })
  .strict();

/**
 * Request body schema for `PATCH /mobile/phases/:id/status`.
 * Restricted to mobile board transitions.
 */
export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(
      [PhaseStatus.IN_PROGRESS, PhaseStatus.COMPLETED, PhaseStatus.POSTPONED],
      { message: 'Invalid phase status' }
    ),
  })
  .strict();
