import { z } from 'zod';
import { Inspection, Project, ProjectPhase, TimeLog, User } from '@prisma/client';
import {
  completeInspectionSchema,
  getCrewTimeQuerySchema,
  getMapQuerySchema,
  getMyTimeLogsQuerySchema,
  getScheduleQuerySchema,
  manualTimeSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
  updatePhaseStatusSchema,
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
 * Validated schedule calendar query.
 */
export type TGetScheduleQuery = z.infer<typeof getScheduleQuerySchema>;

/**
 * Validated map query.
 */
export type TGetMapQuery = z.infer<typeof getMapQuerySchema>;

/**
 * Validated project crew-time query.
 */
export type TGetCrewTimeQuery = z.infer<typeof getCrewTimeQuerySchema>;

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
 * Service params for site-manager project crew-time aggregation.
 */
export type TGetCrewTimeServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Trusted project from existence + access middlewares. */
  project: Project;
  /** Validated query (optional UTC date filter). */
  query: TGetCrewTimeQuery;
};

/**
 * Service params for the Site Manager schedule calendar.
 */
export type TGetScheduleServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Validated inclusive date window. */
  query: TGetScheduleQuery;
};

/**
 * Service params for the Site Manager map tab.
 */
export type TGetMapServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Validated optional phase-type filter. */
  query: TGetMapQuery;
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

/**
 * Validated complete-inspection request body.
 */
export type TCompleteInspectionPayload = z.infer<typeof completeInspectionSchema>;

/**
 * Validated mobile phase-status update request body.
 */
export type TUpdateMobilePhaseStatusPayload = z.infer<
  typeof updatePhaseStatusSchema
>;

/**
 * Service params for listing inspections assigned to a site manager.
 */
export type TListMobileInspectionsServiceParams = {
  /** Authenticated site manager. */
  user: User;
};

/**
 * Service params for fetching one assigned inspection.
 */
export type TGetMobileInspectionServiceParams = {
  /** Trusted inspection already verified as assigned. */
  inspection: Inspection;
};

/**
 * Service params for completing an inspection survey.
 */
export type TCompleteInspectionServiceParams = {
  /** Trusted pending inspection assigned to the user. */
  inspection: Inspection;
  /** Validated scaffold survey payload. */
  payload: TCompleteInspectionPayload;
};

/**
 * Service params for listing phases managed by a site manager.
 */
export type TListMobilePhasesServiceParams = {
  /** Authenticated site manager. */
  user: User;
};

/**
 * Service params for updating a managed phase status from mobile.
 */
export type TUpdateMobilePhaseStatusServiceParams = {
  /** Authenticated site manager (audit actor). */
  user: User;
  /** Trusted phase on a managed project. */
  phase: ProjectPhase;
  /** Validated status payload. */
  payload: TUpdateMobilePhaseStatusPayload;
};
