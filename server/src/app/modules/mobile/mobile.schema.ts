import { ActivityType } from '@prisma/client';
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
 * Path params schema for `GET /mobile/crew-time/:phaseId`.
 */
export const crewTimePhaseParamsSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();
