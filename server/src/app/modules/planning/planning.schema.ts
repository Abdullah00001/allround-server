import { z } from 'zod';

/**
 * Shared YYYY-MM-DD calendar date string validator.
 */
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  });

/**
 * Query schema for `GET /admin/plannings/daily`.
 * Requires a calendar date for the daily board.
 */
export const getDailyPlanQuerySchema = z
  .object({
    date: calendarDateSchema,
  })
  .strict();

/**
 * Request body schema for `POST /admin/plannings/assign-crew`.
 */
export const assignCrewSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    userId: z.string().uuid({ error: 'Invalid user id' }),
    date: calendarDateSchema,
    hours: z.number().positive({ message: 'Hours must be greater than 0' }),
  })
  .strict();

/**
 * Request body schema for `POST /admin/plannings/assign-vehicle`.
 */
export const assignVehicleSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    userId: z.string().uuid({ error: 'Invalid user id' }),
    vehicleId: z.string().uuid({ error: 'Invalid vehicle id' }),
    date: calendarDateSchema,
  })
  .strict();

/**
 * Query schema for `GET /admin/plannings/available-resources`.
 * Optional `phaseId` scopes UI context; date is required for absence/vehicle filters.
 */
export const getAvailableResourcesQuerySchema = z
  .object({
    date: calendarDateSchema,
    phaseId: z.string().uuid({ error: 'Invalid phase id' }).optional(),
  })
  .strict();
