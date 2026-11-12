import { NextFunction, Request, Response } from 'express';
import { Role, TimeLog, User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import { TStopTimerPayload } from '@/app/modules/mobile/mobile.types';

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
 * Used by crew-time endpoints.
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
        message: 'Only site managers can access crew time logs',
        errorType: AuthErrorType.FORBIDDEN,
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
 * Ensures the authenticated site manager is assigned to the phase's project.
 * Must run after `checkPhaseExistenceMiddleware`.
 *
 * @param {Request} req - Express request with trusted `req.user` and `req.phase`.
 * @param {Response} res - Express response used for the 403 envelope.
 * @param {NextFunction} next - Continues when the manager is assigned.
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
