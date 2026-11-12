import { z } from 'zod';
import { TimeLog } from '@prisma/client';
import {
  createTimeLogSchema,
  getTimeLogsQuerySchema,
  updateTimeLogSchema,
} from '@/app/modules/timelog/timelog.schema';

/**
 * Validated list time-logs query string.
 */
export type TGetTimeLogsQuery = z.infer<typeof getTimeLogsQuerySchema>;

/**
 * Validated create time-log request body.
 */
export type TCreateTimeLogPayload = z.infer<typeof createTimeLogSchema>;

/**
 * Validated update time-log request body.
 */
export type TUpdateTimeLogPayload = z.infer<typeof updateTimeLogSchema>;

/**
 * Service params for listing time logs.
 */
export type TListTimeLogsServiceParams = {
  /** Validated list query. */
  query: TGetTimeLogsQuery;
};

/**
 * Service params for creating a manual time log.
 */
export type TCreateTimeLogServiceParams = {
  /** Validated create payload. */
  payload: TCreateTimeLogPayload;
};

/**
 * Service params for approving/rejecting/deleting a time log.
 */
export type TTimeLogMutationServiceParams = {
  /** Trusted time log from existence middleware. */
  timeLog: TimeLog;
};

/**
 * Service params for admin time-log edits.
 */
export type TUpdateTimeLogServiceParams = {
  /** Trusted time log from existence middleware. */
  timeLog: TimeLog;
  /** Validated partial update payload. */
  payload: TUpdateTimeLogPayload;
};
