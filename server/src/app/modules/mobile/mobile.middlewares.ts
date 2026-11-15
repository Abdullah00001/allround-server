import { NextFunction, Request, Response } from 'express';
import {
  Attachment,
  Inspection,
  InspectionStatus,
  Project,
  ProjectMeasurement,
  ProjectNote,
  ProjectTask,
  Role,
  TimeLog,
  User,
} from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TCreateProjectTaskPayload,
  TGetCrewTimeQuery,
  TStopTimerPayload,
} from '@/app/modules/mobile/mobile.types';

/**
 * Blocks employee manual time entries when company settings disable them.
 * Site managers are never blocked by this toggle. Missing profile defaults to allowed.
 *
 * @param {Request} req - Express request with authenticated `req.user`.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when manual time is allowed.
 * @returns {Promise<void>}
 */
export const checkEmployeeManualTimeAllowedMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;

    if (user.role !== Role.EMPLOYEE) {
      next();
      return;
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: { allowEmployeeManualTime: true },
    });

    const allowed = profile?.allowEmployeeManualTime ?? true;
    if (!allowed) {
      res.status(403).json({
        success: false,
        message: 'Manual time entries are disabled by your administrator.',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Blocks starting a new timer when the user already has an open `TimeLog`
 * (`endTime: null`). Responds with 409 `ACTIVE_TIMER_EXISTS`.
 *
 * @param {Request} req - Express request with authenticated `req.user`.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when no active timer exists.
 * @returns {Promise<void>}
 */
export const checkNoActiveTimerMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;

    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId: user.id,
        endTime: null,
      },
      select: { id: true },
    });

    if (activeTimer) {
      res.status(409).json({
        success: false,
        message: 'An active timer already exists',
        errorType: AuthErrorType.ACTIVE_TIMER_EXISTS,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Restricts access to Site Managers only.
 * Used by crew-time, inspection, and mobile phase-board endpoints.
 *
 * @param {Request} req - Express request with authenticated `req.user`.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when the user is a SITE_MANAGER.
 * @returns {Promise<void>}
 */
export const checkSiteManagerRoleMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;

    if (user.role !== Role.SITE_MANAGER) {
      res.status(403).json({
        success: false,
        message: 'Only site managers can access this resource',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Maps `req.params.id` onto `req.params.phaseId` so shared phase middleware can be reused
 * on routes that use `/:id` instead of `/:phaseId`.
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} _res - Express response (unused).
 * @param {NextFunction} next - Continues after mapping.
 * @returns {void}
 */
export const mapPhaseIdFromParamsMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (typeof req.params.id === 'string' && req.params.id.length > 0) {
    req.params.phaseId = req.params.id;
  }
  next();
};

/**
 * Ensures the authenticated site manager is the assigned `siteManagerId`
 * on `req.inspection`. Must run after `checkInspectionExistenceMiddleware`.
 *
 * @param {Request} req - Express request with trusted inspection and user.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when the inspection is assigned to the user.
 * @returns {Promise<void>}
 */
export const checkInspectionAssignedToSiteManagerMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const inspection = req.inspection as Inspection | undefined;

    if (!inspection || inspection.siteManagerId !== user.id) {
      res.status(403).json({
        success: false,
        message: 'You are not assigned to this inspection',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Ensures the assigned inspection is still `PENDING` before survey completion.
 * Must run after assignment middleware.
 *
 * @param {Request} req - Express request with trusted `req.inspection`.
 * @param {Response} res - Express response used for the 400 envelope.
 * @param {NextFunction} next - Continues when status is PENDING.
 * @returns {Promise<void>}
 */
export const checkInspectionPendingForSurveyMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;

    if (inspection.status !== InspectionStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: 'Inspection is not pending survey completion',
        errorType: AuthErrorType.BAD_REQUEST,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Verifies that `req.body.timeLogId` is an open time log owned by the authenticated user.
 * Attaches the log to `req.timeLog` on success.
 *
 * @param {Request} req - Express request with validated stop body and `req.user`.
 * @param {Response} res - Express response used for 404 envelopes.
 * @param {NextFunction} next - Continues when the open owned log exists.
 * @returns {Promise<void>}
 */
export const checkOwnedActiveTimeLogMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const { timeLogId } = req.body as TStopTimerPayload;

    const timeLog = await prisma.timeLog.findFirst({
      where: {
        id: timeLogId,
        userId: user.id,
        endTime: null,
      },
    });

    if (!timeLog) {
      res.status(404).json({
        success: false,
        message: 'Active time log not found',
        errorType: AuthErrorType.TIMELOG_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.timeLog = timeLog as TimeLog;
    next();
  }
);

/**
 * Ensures the authenticated site manager is assigned to the phase's project,
 * or has company-wide `GLOBAL_ACCESS`. Must run after `checkPhaseExistenceMiddleware`.
 *
 * @param {Request} req - Express request with trusted `req.user` and `req.phase`.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when the manager may access the phase.
 * @returns {Promise<void>}
 */
export const checkSiteManagerPhaseAccessMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const phase = req.phase;

    if (!phase) {
      res.status(404).json({
        success: false,
        message: 'Phase not found',
        errorType: AuthErrorType.PHASE_NOT_FOUND,
        traceId,
      });
      return;
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: { siteManagerAccessRule: true },
    });

    if (profile?.siteManagerAccessRule === 'GLOBAL_ACCESS') {
      next();
      return;
    }

    const assignment = await prisma.projectManagerAssignment.findUnique({
      where: {
        projectId_userId: {
          projectId: phase.projectId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (!assignment) {
      res.status(403).json({
        success: false,
        message: 'You are not assigned to this project',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Loads a non-deleted project from validated `projectId` query for crew-time.
 * Attaches the Prisma `Project` to `req.project` on success.
 *
 * @param {Request} req - Express request with `validatedQuery.projectId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the project exists.
 * @returns {Promise<void>}
 */
export const checkCrewTimeProjectExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetCrewTimeQuery;

    const project = await prisma.project.findFirst({
      where: { id: query.projectId, deletedAt: null },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
        errorType: AuthErrorType.PROJECT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.project = project as Project;
    next();
  }
);

/**
 * Ensures the authenticated site manager may view crew time for `req.project`.
 * Allows access when `siteManagerAccessRule` is `GLOBAL_ACCESS` or when the
 * user has a `ProjectManagerAssignment` on the project.
 *
 * @param {Request} req - Express request with trusted `req.user` and `req.project`.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when access is allowed.
 * @returns {Promise<void>}
 */
export const checkSiteManagerProjectAccessMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project;

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
        errorType: AuthErrorType.PROJECT_NOT_FOUND,
        traceId,
      });
      return;
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: { siteManagerAccessRule: true },
    });

    if (profile?.siteManagerAccessRule === 'GLOBAL_ACCESS') {
      next();
      return;
    }

    const assignment = await prisma.projectManagerAssignment.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (!assignment) {
      res.status(403).json({
        success: false,
        message: 'You are not assigned to this project',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Loads a non-deleted project from validated `params.projectId`.
 * Attaches the Prisma `Project` to `req.project` on success.
 *
 * @param {Request} req - Express request with validated `params.projectId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the project exists.
 * @returns {Promise<void>}
 */
export const checkMobileProjectExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const projectId = req.params.projectId as string;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
        errorType: AuthErrorType.PROJECT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.project = project as Project;
    next();
  }
);

/**
 * Ensures a phase belongs to `req.project` (after both existence middlewares).
 *
 * @param {Request} req - Express request with trusted `req.project` and `req.phase`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the phase belongs to the project.
 * @returns {Promise<void>}
 */
export const checkPhaseBelongsToProjectMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project;
    const phase = req.phase;

    if (!project || !phase || phase.projectId !== project.id) {
      res.status(404).json({
        success: false,
        message: 'Phase not found',
        errorType: AuthErrorType.PHASE_NOT_FOUND,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Loads a project task by `params.taskId` and attaches parent project for access checks.
 *
 * @param {Request} req - Express request with validated `params.taskId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the task (and parent project) exist.
 * @returns {Promise<void>}
 */
export const checkProjectTaskExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const taskId = req.params.taskId as string;

    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
        errorType: AuthErrorType.TASK_NOT_FOUND,
        traceId,
      });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: task.projectId, deletedAt: null },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
        errorType: AuthErrorType.PROJECT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.projectTask = task as ProjectTask;
    req.project = project as Project;
    next();
  }
);

/**
 * Ensures `body.employeeId` references an active non-deleted workforce user.
 *
 * @param {Request} req - Express request with validated create-task body.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the assignee exists.
 * @returns {Promise<void>}
 */
export const checkTaskAssigneeExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { employeeId } = req.body as TCreateProjectTaskPayload;

    const employee = await prisma.user.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        role: { in: [Role.EMPLOYEE, Role.SITE_MANAGER] },
      },
      select: { id: true },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        errorType: AuthErrorType.USER_NOT_FOUND,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Loads a measurement by `params.id` that belongs to `params.projectId`.
 *
 * @param {Request} req - Express request with validated project/child ids.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the measurement exists on the project.
 * @returns {Promise<void>}
 */
export const checkProjectMeasurementExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const projectId = req.params.projectId as string;
    const id = req.params.id as string;

    const measurement = await prisma.projectMeasurement.findFirst({
      where: { id, projectId },
    });

    if (!measurement) {
      res.status(404).json({
        success: false,
        message: 'Measurement not found',
        errorType: AuthErrorType.MEASUREMENT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.projectMeasurement = measurement as ProjectMeasurement;
    next();
  }
);

/**
 * Loads a note by `params.id` that belongs to `params.projectId`.
 *
 * @param {Request} req - Express request with validated project/child ids.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the note exists on the project.
 * @returns {Promise<void>}
 */
export const checkProjectNoteExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const projectId = req.params.projectId as string;
    const id = req.params.id as string;

    const note = await prisma.projectNote.findFirst({
      where: { id, projectId },
    });

    if (!note) {
      res.status(404).json({
        success: false,
        message: 'Note not found',
        errorType: AuthErrorType.NOTE_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.projectNote = note as ProjectNote;
    next();
  }
);

/**
 * Loads an attachment by `params.id` that belongs to `params.projectId`.
 *
 * @param {Request} req - Express request with validated project/child ids.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the attachment exists on the project.
 * @returns {Promise<void>}
 */
export const checkProjectAttachmentExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const projectId = req.params.projectId as string;
    const id = req.params.id as string;

    const attachment = await prisma.attachment.findFirst({
      where: { id, projectId },
    });

    if (!attachment) {
      res.status(404).json({
        success: false,
        message: 'Attachment not found',
        errorType: AuthErrorType.ATTACHMENT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.attachment = attachment as Attachment;
    next();
  }
);
