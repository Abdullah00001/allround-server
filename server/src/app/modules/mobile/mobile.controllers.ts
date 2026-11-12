import { Request, Response } from 'express';
import {
  Inspection,
  Project,
  ProjectPhase,
  TimeLog,
  User,
} from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  completeMobileInspectionService,
  createManualTimeService,
  getCrewTimeService,
  getDashboardDataService,
  getMapDataService,
  getMobileConfigService,
  getMobileInspectionByIdService,
  getMyProjectsService,
  getMyTimeLogsService,
  getProfileStatsService,
  getScheduleService,
  listMobileInspectionsService,
  listMobilePhasesService,
  startTimerService,
  stopTimerService,
  syncTimeLogsService,
  updateMobilePhaseStatusService,
} from '@/app/modules/mobile/mobile.services';
import {
  TCompleteInspectionPayload,
  TGetCrewTimeQuery,
  TGetMapQuery,
  TGetMyTimeLogsQuery,
  TGetScheduleQuery,
  TManualTimePayload,
  TStartTimerPayload,
  TStopTimerPayload,
  TSyncTimeLogsPayload,
  TUpdateMobilePhaseStatusPayload,
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
 * Returns projects assigned to the authenticated user.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getMyProjectsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await getMyProjectsService({ user });

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
