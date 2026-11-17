import { z } from 'zod';
import {
  Attachment,
  Customer,
  Inspection,
  Project,
  ProjectMeasurement,
  ProjectNote,
  ProjectPhase,
  ProjectTask,
  TimeLog,
  User,
} from '@prisma/client';
import {
  completeInspectionSchema,
  createMeasurementSchema,
  createMobileProjectSchema,
  createProjectAttachmentSchema,
  createProjectNoteSchema,
  createProjectTaskSchema,
  getCrewTimeQuerySchema,
  getDashboardQuerySchema,
  getMapQuerySchema,
  getMobileCustomersQuerySchema,
  getMobileInspectionsQuerySchema,
  getMobilePhasesQuerySchema,
  getMyProjectsQuerySchema,
  getMyTimeLogsQuerySchema,
  getProjectAttachmentsQuerySchema,
  getProjectEmployeesQuerySchema,
  getProjectListQuerySchema,
  getProjectTasksQuerySchema,
  getScheduleQuerySchema,
  getTimeTrackingProjectsQuerySchema,
  employeeManualTimeSchema,
  employeeStartTimerSchema,
  manualTimeSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
  updateMeasurementSchema,
  updateMobileProjectSchema,
  updatePhaseDatesSchema,
  updateMobileProfileSchema,
  updatePhaseStatusSchema,
  updateProjectNoteSchema,
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
 * Validated self-profile patch body.
 */
export type TUpdateMobileProfilePayload = z.infer<
  typeof updateMobileProfileSchema
>;

/**
 * Service params for patching the authenticated mobile user's profile.
 */
export type TUpdateMobileProfileServiceParams = {
  /** Trusted authenticated user. */
  user: User;
  /** Validated patch payload (≥1 field). */
  payload: TUpdateMobileProfilePayload;
};

/**
 * Service params for paginated dashboard.
 */
export type TGetDashboardServiceParams = {
  /** Trusted authenticated user from the mobile auth chain. */
  user: User;
  /** Validated page/limit query. */
  query: TGetDashboardQuery;
};

/**
 * Validated start-timer request body (shared / site-manager).
 */
export type TStartTimerPayload = z.infer<typeof startTimerSchema>;

/**
 * Validated employee start-timer body (`projectId` or `phaseId`).
 */
export type TEmployeeStartTimerPayload = z.infer<
  typeof employeeStartTimerSchema
>;

/**
 * Validated stop-timer request body.
 */
export type TStopTimerPayload = z.infer<typeof stopTimerSchema>;

/**
 * Validated manual time-entry request body (shared / site-manager).
 */
export type TManualTimePayload = z.infer<typeof manualTimeSchema>;

/**
 * Validated employee Add Time Entry body.
 */
export type TEmployeeManualTimePayload = z.infer<
  typeof employeeManualTimeSchema
>;

/**
 * Validated sync request body.
 */
export type TSyncTimeLogsPayload = z.infer<typeof syncTimeLogsSchema>;

/**
 * Validated dashboard query (page/limit for upcomingTasks + mapPins).
 */
export type TGetDashboardQuery = z.infer<typeof getDashboardQuerySchema>;

/**
 * Validated my-time-logs query.
 */
export type TGetMyTimeLogsQuery = z.infer<typeof getMyTimeLogsQuerySchema>;

/**
 * Validated time-tracking assigned-projects query.
 */
export type TGetTimeTrackingProjectsQuery = z.infer<
  typeof getTimeTrackingProjectsQuerySchema
>;

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
 * Validated deep project-list filters.
 */
export type TGetMyProjectsQuery = z.infer<typeof getMyProjectsQuerySchema>;

/**
 * Validated project tasks list query.
 */
export type TGetProjectTasksQuery = z.infer<typeof getProjectTasksQuerySchema>;

/**
 * Validated project employees picker query (search + pagination).
 */
export type TGetProjectEmployeesQuery = z.infer<
  typeof getProjectEmployeesQuerySchema
>;

/**
 * Validated project child list query (notes / measurements / history).
 */
export type TGetProjectListQuery = z.infer<typeof getProjectListQuerySchema>;

/**
 * Validated create-task request body.
 */
export type TCreateProjectTaskPayload = z.infer<typeof createProjectTaskSchema>;

/**
 * Validated create-measurement request body.
 */
export type TCreateMeasurementPayload = z.infer<typeof createMeasurementSchema>;

/**
 * Validated create-note request body.
 */
export type TCreateProjectNotePayload = z.infer<typeof createProjectNoteSchema>;

/**
 * Validated Site Manager create-project request body.
 */
export type TCreateMobileProjectPayload = z.infer<
  typeof createMobileProjectSchema
>;

/**
 * Validated project-settings patch body.
 */
export type TUpdateMobileProjectPayload = z.infer<
  typeof updateMobileProjectSchema
>;

/**
 * Service params for Site Manager project creation.
 */
export type TCreateMobileProjectServiceParams = {
  /** Authenticated site manager (creator). */
  user: User;
  /** Assigned PM site manager (self or selected). */
  siteManager: User;
  /** Existing customer when mode is EXISTING; undefined for NEW. */
  customer?: Customer;
  /** Validated create payload. */
  payload: TCreateMobileProjectPayload;
};
/**
 * Validated phase-dates patch body.
 */
export type TUpdatePhaseDatesPayload = z.infer<typeof updatePhaseDatesSchema>;

/**
 * Validated project-attachment create body.
 */
export type TCreateProjectAttachmentPayload = z.infer<
  typeof createProjectAttachmentSchema
>;

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
 * Service params for Time Tracking assigned-project dropdown.
 */
export type TGetTimeTrackingProjectsServiceParams = {
  /** Authenticated employee or site manager. */
  user: User;
  /** Validated pagination query. */
  query: TGetTimeTrackingProjectsQuery;
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
 * Service params for schedule calendars (SM or employee My Plan).
 */
export type TGetScheduleServiceParams = {
  /** Authenticated user (role enforced by route middleware). */
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
 * Validated inspections list query (Pending / Completed tabs).
 */
export type TGetMobileInspectionsQuery = z.infer<
  typeof getMobileInspectionsQuerySchema
>;

/**
 * Validated phase board column query.
 */
export type TGetMobilePhasesQuery = z.infer<typeof getMobilePhasesQuerySchema>;

/**
 * Validated attachments list query.
 */
export type TGetProjectAttachmentsQuery = z.infer<
  typeof getProjectAttachmentsQuerySchema
>;

/**
 * Validated note update body.
 */
export type TUpdateProjectNotePayload = z.infer<typeof updateProjectNoteSchema>;

/**
 * Validated measurement update body.
 */
export type TUpdateMeasurementPayload = z.infer<typeof updateMeasurementSchema>;

/**
 * Service params for listing inspections assigned to a site manager.
 */
export type TListMobileInspectionsServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Pending vs Completed tab filter. */
  query: TGetMobileInspectionsQuery;
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
  /** Optional Phase Board column filter. */
  query: TGetMobilePhasesQuery;
};

/**
 * Service params for listing project attachments.
 */
export type TListProjectAttachmentsServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Optional category filter. */
  query: TGetProjectAttachmentsQuery;
};

/**
 * Service params for setting a project photo as cover.
 */
export type TSetProjectAttachmentCoverServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Trusted PHOTO attachment on the project. */
  attachment: Attachment;
};

/**
 * Service params for updating a project note.
 */
export type TUpdateProjectNoteServiceParams = {
  /** Trusted note. */
  note: ProjectNote;
  /** Validated patch payload. */
  payload: TUpdateProjectNotePayload;
};

/**
 * Service params for updating a measurement.
 */
export type TUpdateMeasurementServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Trusted measurement. */
  measurement: ProjectMeasurement;
  /** Validated patch payload. */
  payload: TUpdateMeasurementPayload;
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

/**
 * Service params for listing projects with optional deep filters.
 */
export type TGetMyProjectsServiceParams = {
  /** Authenticated mobile user. */
  user: User;
  /** Validated list filters / sort. */
  query: TGetMyProjectsQuery;
};

/**
 * Service params for project-scoped SM management reads/writes.
 */
export type TMobileProjectServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Trusted accessible project. */
  project: Project;
};

/**
 * Service params for paginated project tasks list.
 */
export type TListProjectTasksServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Trusted accessible project. */
  project: Project;
  /** Validated page/limit and optional OPEN/COMPLETED filter. */
  query: TGetProjectTasksQuery;
};

/**
 * Service params for SM task-creation employee picker.
 */
export type TListProjectEmployeesServiceParams = {
  /** Authenticated site manager (access already gated by middleware). */
  user: User;
  /** Trusted accessible project (scopes route auth, not the user filter). */
  project: Project;
  /** Validated search + pagination query. */
  query: TGetProjectEmployeesQuery;
};

/**
 * Service params for paginated project child lists (notes/measurements/history).
 */
export type TListProjectChildServiceParams = {
  /** Authenticated site manager. */
  user: User;
  /** Trusted accessible project. */
  project: Project;
  /** Validated page/limit query. */
  query: TGetProjectListQuery;
};

/**
 * Service params for creating a project task.
 */
export type TCreateProjectTaskServiceParams = {
  /** Authenticated site manager (audit actor). */
  user: User;
  /** Trusted accessible project. */
  project: Project;
  /** Validated create payload. */
  payload: TCreateProjectTaskPayload;
};

/**
 * Service params for toggling or deleting a task.
 */
export type TProjectTaskServiceParams = {
  /** Trusted project task. */
  task: ProjectTask;
};

/**
 * Service params for creating a measurement line item.
 */
export type TCreateMeasurementServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Validated create payload. */
  payload: TCreateMeasurementPayload;
};

/**
 * Service params for deleting a measurement.
 */
export type TDeleteMeasurementServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Trusted measurement belonging to the project. */
  measurement: ProjectMeasurement;
};

/**
 * Service params for creating a project note.
 */
export type TCreateProjectNoteServiceParams = {
  /** Authenticated author. */
  user: User;
  /** Trusted accessible project. */
  project: Project;
  /** Validated create payload. */
  payload: TCreateProjectNotePayload;
};

/**
 * Service params for deleting a project note.
 */
export type TDeleteProjectNoteServiceParams = {
  /** Trusted note belonging to the project. */
  note: ProjectNote;
};

/**
 * Service params for patching project settings.
 */
export type TUpdateMobileProjectServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Validated patch payload. */
  payload: TUpdateMobileProjectPayload;
};

/**
 * Service params for patching phase dates.
 */
export type TUpdatePhaseDatesServiceParams = {
  /** Trusted phase belonging to the accessible project. */
  phase: ProjectPhase;
  /** Validated dates payload. */
  payload: TUpdatePhaseDatesPayload;
};

/**
 * Service params for creating a project attachment row.
 */
export type TCreateProjectAttachmentServiceParams = {
  /** Trusted accessible project. */
  project: Project;
  /** Validated attachment payload. */
  payload: TCreateProjectAttachmentPayload;
};

/**
 * Service params for deleting a project attachment.
 */
export type TDeleteProjectAttachmentServiceParams = {
  /** Trusted attachment belonging to the project. */
  attachment: Attachment;
};

/**
 * Validated query params for `GET /mobile/customers`.
 */
export type TGetMobileCustomersQuery = z.infer<
  typeof getMobileCustomersQuerySchema
>;

/**
 * Service params for fetching customer directory on mobile.
 */
export type TListMobileCustomersServiceParams = {
  /** Validated pagination and filter query. */
  query: TGetMobileCustomersQuery;
};

