import { Request, Response } from 'express';
import {
  Attachment,
  Inspection,
  Project,
  ProjectMeasurement,
  ProjectNote,
  ProjectPhase,
  ProjectTask,
  TimeLog,
  User,
} from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  completeMobileInspectionService,
  createManualTimeService,
  createProjectAttachmentService,
  createProjectMeasurementService,
  createProjectNoteService,
  createProjectTaskService,
  deleteProjectAttachmentService,
  deleteProjectMeasurementService,
  deleteProjectNoteService,
  deleteProjectTaskService,
  getCrewTimeService,
  getDashboardDataService,
  getMapDataService,
  getMobileConfigService,
  getMobileInspectionByIdService,
  getMyProjectsService,
  getMyTimeLogsService,
  getProfileStatsService,
  getProjectFilterOptionsService,
  getScheduleService,
  listMobileInspectionsService,
  listMobilePhasesService,
  listProjectMeasurementsService,
  listProjectNotesService,
  listProjectTasksService,
  startTimerService,
  stopTimerService,
  syncTimeLogsService,
  toggleProjectTaskService,
  updateMobilePhaseStatusService,
  updateMobileProjectService,
  updatePhaseDatesService,
} from '@/app/modules/mobile/mobile.services';
import {
  TCompleteInspectionPayload,
  TCreateMeasurementPayload,
  TCreateProjectAttachmentPayload,
  TCreateProjectNotePayload,
  TCreateProjectTaskPayload,
  TGetCrewTimeQuery,
  TGetMapQuery,
  TGetMyProjectsQuery,
  TGetMyTimeLogsQuery,
  TGetScheduleQuery,
  TManualTimePayload,
  TStartTimerPayload,
  TStopTimerPayload,
  TSyncTimeLogsPayload,
  TUpdateMobilePhaseStatusPayload,
  TUpdateMobileProjectPayload,
  TUpdatePhaseDatesPayload,
} from '@/app/modules/mobile/mobile.types';

/**
 * Handles `GET /mobile/config`.
 * Returns company language settings, manual-time policy, and legal contents.
 *
 * @param {Request} _req - Express request (auth already validated).
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMobileConfigController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const data = await getMobileConfigService();

    res.status(200).json({
      success: true,
      message: 'Mobile config fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/dashboard`.
 * Returns home-screen stats, upcoming tasks, and map pins for the authenticated user.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getDashboardController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await getDashboardDataService({ user });

    res.status(200).json({
      success: true,
      message: 'Dashboard fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/projects`.
 * Returns projects assigned to the authenticated user with optional deep filters.
 *
 * @param {Request} req - Express request with trusted `req.user` and validated query.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMyProjectsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const query = req.validatedQuery as TGetMyProjectsQuery;
    const data = await getMyProjectsService({ user, query });

    res.status(200).json({
      success: true,
      message: 'Projects fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/profile`.
 * Returns profile fields and weekly/project stats for the authenticated user.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getProfileController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await getProfileStatsService({ user });

    res.status(200).json({
      success: true,
      message: 'Profile fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/timer/start`.
 * Relies on no-active-timer + phase existence middlewares.
 *
 * @param {Request} req - Express request with trusted user/phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const startTimerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TStartTimerPayload;
    const data = await startTimerService({ user, phase, payload });

    res.status(201).json({
      success: true,
      message: 'Timer started successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/timer/stop`.
 * Relies on owned-active-time-log middleware.
 *
 * @param {Request} req - Express request with trusted open `req.timeLog`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const stopTimerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;
    const payload = req.body as TStopTimerPayload;
    const data = await stopTimerService({ timeLog, payload });

    res.status(200).json({
      success: true,
      message: 'Timer stopped successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/timer/manual`.
 * Creates a pending-approval manual entry.
 *
 * @param {Request} req - Express request with trusted user/phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createManualTimeController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TManualTimePayload;
    const data = await createManualTimeService({ user, phase, payload });

    res.status(201).json({
      success: true,
      message: 'Manual time entry submitted for approval.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/time-logs`.
 * Returns the authenticated user's logs for TODAY/WEEK/MONTH.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMyTimeLogsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const query = req.validatedQuery as TGetMyTimeLogsQuery;
    const data = await getMyTimeLogsService({ user, query });

    res.status(200).json({
      success: true,
      message: 'Time logs fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/crew-time`.
 * Site-manager-only aggregated crew time for a managed project.
 *
 * @param {Request} req - Express request with trusted user/project and query.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getCrewTimeController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const query = req.validatedQuery as TGetCrewTimeQuery;
    const data = await getCrewTimeService({ user, project, query });

    res.status(200).json({
      success: true,
      message: 'Crew time fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/schedule`.
 * Site-manager calendar: phases grouped by UTC date within the query window.
 *
 * @param {Request} req - Express request with trusted user and date query.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getScheduleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const query = req.validatedQuery as TGetScheduleQuery;
    const data = await getScheduleService({ user, query });

    res.status(200).json({
      success: true,
      message: 'Schedule fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/map`.
 * Site-manager map pins for projects with active phases.
 *
 * @param {Request} req - Express request with trusted user and optional type filter.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMapController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const query = req.validatedQuery as TGetMapQuery;
    const data = await getMapDataService({ user, query });

    res.status(200).json({
      success: true,
      message: 'Map data fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/sync`.
 * Idempotently syncs offline time logs for the authenticated user.
 *
 * @param {Request} req - Express request with validated sync body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const syncTimeLogsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const payload = req.body as TSyncTimeLogsPayload;
    const data = await syncTimeLogsService({ user, payload });

    res.status(200).json({
      success: true,
      message: 'Time logs synced successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/inspections`.
 * Site-manager-only list of assigned PENDING/SURVEY_DONE inspections.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listMobileInspectionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await listMobileInspectionsService({ user });

    res.status(200).json({
      success: true,
      message: 'Inspections fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/inspections/:id`.
 * Relies on existence + assignment middlewares.
 *
 * @param {Request} req - Express request with trusted `req.inspection`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMobileInspectionByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;
    const data = await getMobileInspectionByIdService({ inspection });

    res.status(200).json({
      success: true,
      message: 'Inspection fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile/inspections/:id/complete`.
 * Saves survey specs and marks the inspection SURVEY_DONE.
 *
 * @param {Request} req - Express request with trusted inspection and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const completeMobileInspectionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;
    const payload = req.body as TCompleteInspectionPayload;
    const data = await completeMobileInspectionService({
      inspection,
      payload,
    });

    res.status(200).json({
      success: true,
      message: 'Inspection survey completed successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/phases`.
 * Site-manager-only list of phases on managed projects.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listMobilePhasesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await listMobilePhasesService({ user });

    res.status(200).json({
      success: true,
      message: 'Phases fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile/phases/:id/status`.
 * Updates managed phase status and writes a mobile audit log entry.
 *
 * @param {Request} req - Express request with trusted user/phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateMobilePhaseStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TUpdateMobilePhaseStatusPayload;
    const data = await updateMobilePhaseStatusService({
      user,
      phase,
      payload,
    });

    res.status(200).json({
      success: true,
      message: 'Phase status updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/projects/filter-options`.
 * Returns filter-modal option bags for Site Managers.
 *
 * @param {Request} req - Express request with trusted site manager.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getProjectFilterOptionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await getProjectFilterOptionsService({ user });

    res.status(200).json({
      success: true,
      message: 'Project filter options fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/projects/:projectId/tasks`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectTasksController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const data = await listProjectTasksService({ user, project });

    res.status(200).json({
      success: true,
      message: 'Project tasks fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/projects/:projectId/tasks`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const payload = req.body as TCreateProjectTaskPayload;
    const data = await createProjectTaskService({ user, project, payload });

    res.status(201).json({
      success: true,
      message: 'Project task created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile/tasks/:taskId/toggle`.
 *
 * @param {Request} req - Express request with trusted task.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const toggleProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const task = req.projectTask as ProjectTask;
    const data = await toggleProjectTaskService({ task });

    res.status(200).json({
      success: true,
      message: 'Project task toggled successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /mobile/tasks/:taskId`.
 *
 * @param {Request} req - Express request with trusted task.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const task = req.projectTask as ProjectTask;
    const data = await deleteProjectTaskService({ task });

    res.status(200).json({
      success: true,
      message: 'Project task deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/projects/:projectId/measurements`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectMeasurementsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const data = await listProjectMeasurementsService({ user, project });

    res.status(200).json({
      success: true,
      message: 'Project measurements fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/projects/:projectId/measurements`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectMeasurementController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TCreateMeasurementPayload;
    const data = await createProjectMeasurementService({ project, payload });

    res.status(201).json({
      success: true,
      message: 'Project measurement created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /mobile/projects/:projectId/measurements/:id`.
 *
 * @param {Request} req - Express request with trusted project and measurement.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectMeasurementController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const measurement = req.projectMeasurement as ProjectMeasurement;
    const data = await deleteProjectMeasurementService({
      project,
      measurement,
    });

    res.status(200).json({
      success: true,
      message: 'Project measurement deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /mobile/projects/:projectId/notes`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectNotesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const data = await listProjectNotesService({ user, project });

    res.status(200).json({
      success: true,
      message: 'Project notes fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/projects/:projectId/notes`.
 *
 * @param {Request} req - Express request with trusted user/project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectNoteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const payload = req.body as TCreateProjectNotePayload;
    const data = await createProjectNoteService({ user, project, payload });

    res.status(201).json({
      success: true,
      message: 'Project note created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /mobile/projects/:projectId/notes/:id`.
 *
 * @param {Request} req - Express request with trusted note.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectNoteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const note = req.projectNote as ProjectNote;
    const data = await deleteProjectNoteService({ note });

    res.status(200).json({
      success: true,
      message: 'Project note deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile/projects/:projectId`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateMobileProjectController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TUpdateMobileProjectPayload;
    const data = await updateMobileProjectService({ project, payload });

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile/projects/:projectId/phases/:phaseId/dates`.
 *
 * @param {Request} req - Express request with trusted phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updatePhaseDatesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TUpdatePhaseDatesPayload;
    const data = await updatePhaseDatesService({ phase, payload });

    res.status(200).json({
      success: true,
      message: 'Phase dates updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /mobile/projects/:projectId/attachments`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectAttachmentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TCreateProjectAttachmentPayload;
    const data = await createProjectAttachmentService({ project, payload });

    res.status(201).json({
      success: true,
      message: 'Project attachment created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /mobile/projects/:projectId/attachments/:id`.
 *
 * @param {Request} req - Express request with trusted attachment.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectAttachmentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const attachment = req.attachment as Attachment;
    const data = await deleteProjectAttachmentService({ attachment });

    res.status(200).json({
      success: true,
      message: 'Project attachment deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);
