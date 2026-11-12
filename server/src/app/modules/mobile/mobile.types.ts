import { z } from 'zod';
import { ProjectPhase, TimeLog, User } from '@prisma/client';
import {
  getMyTimeLogsQuerySchema,
  manualTimeSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
} from '@/app/modules/mobile/mobile.schema';

/**
 * Service params for dashboard, projects, and profile endpoints.
 * Always scoped to the authenticated mobile user.
 */
export type TMobileUserServiceParams = {
  /** Trusted authenticated user from the mobile auth chain. */
  user: User;
};

/**
 * Validated start-timer request body.
 */
export type TStartTimerPayload = z.infer<typeof startTimerSchema>;

/**
 * Validated stop-timer request body.
 */
export type TStopTimerPayload = z.infer<typeof stopTimerSchema>;

/**
 * Validated manual time-entry request body.
 */
export type TManualTimePayload = z.infer<typeof manualTimeSchema>;

/**
 * Validated sync request body.
 */
export type TSyncTimeLogsPayload = z.infer<typeof syncTimeLogsSchema>;

/**
 * Validated my-time-logs query.
 */
export type TGetMyTimeLogsQuery = z.infer<typeof getMyTimeLogsQuerySchema>;

/**
 * Service params for starting a timer.
 */
export type TStartTimerServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Trusted phase from existence middleware. */
  phase: ProjectPhase;
  /** Validated start payload. */
  payload: TStartTimerPayload;
};

/**
 * Service params for stopping a timer.
 */
export type TStopTimerServiceParams = {
  /** Trusted open time log owned by the user. */
  timeLog: TimeLog;
  /** Validated stop payload (GPS end optional). */
  payload: TStopTimerPayload;
};

/**
 * Service params for creating a manual time entry.
 */
export type TManualTimeServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Trusted phase from existence middleware. */
  phase: ProjectPhase;
  /** Validated manual payload. */
  payload: TManualTimePayload;
};

/**
 * Service params for listing the user's time logs by period.
 */
export type TGetMyTimeLogsServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Validated period query. */
  query: TGetMyTimeLogsQuery;
};

/**
 * Service params for site-manager crew time view.
 */
export type TGetCrewTimeServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Trusted phase from existence middleware. */
  phase: ProjectPhase;
};

/**
 * Service params for offline bulk sync.
 */
export type TSyncTimeLogsServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Validated sync payload. */
  payload: TSyncTimeLogsPayload;
};
