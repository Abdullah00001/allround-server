import { NextFunction, Request, Response } from 'express';
import { TimeLog, TimeLogStatus, User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TCreateTimeLogPayload,
  TUpdateTimeLogPayload,
} from '@/app/modules/timelog/timelog.types';

/**
 * Verifies that a time log exists for `req.params.id`.
 * Attaches the Prisma `TimeLog` to `req.timeLog` on success.
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the time log exists.
 * @returns {Promise<void>}
 */
export const checkTimeLogExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const timeLogId = req.params.id as string;

    const timeLog = await prisma.timeLog.findUnique({
      where: { id: timeLogId },
    });

    if (!timeLog) {
      res.status(404).json({
        success: false,
        message: 'Time log not found',
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
 * Verifies that `req.body.userId` references a non-deleted user.
 * Attaches the user to `req.targetUser` on success.
 *
 * @param {Request} req - Express request with validated create body.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the user exists.
 * @returns {Promise<void>}
 */
export const checkTimeLogUserExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { userId } = req.body as TCreateTimeLogPayload;

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        errorType: AuthErrorType.USER_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.targetUser = user as User;
    next();
  }
);

/**
 * Ensures the attached time log is currently `PENDING_APPROVAL`.
 * Must run after `checkTimeLogExistenceMiddleware` on approve/reject routes.
 *
 * @param {Request} req - Express request with trusted `req.timeLog`.
 * @param {Response} res - Express response used for the 400 envelope.
 * @param {NextFunction} next - Continues when the log is pending approval.
 * @returns {Promise<void>}
 */
export const checkTimeLogPendingMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;

    if (timeLog.status !== TimeLogStatus.PENDING_APPROVAL) {
      res.status(400).json({
        success: false,
        message: 'Time log is not pending approval',
        errorType: AuthErrorType.BAD_REQUEST,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Enforces `CompanyProfile.requireReasonForTimeEdit` on admin time-log edits.
 * When the setting is enabled, a non-empty `reason` body field is required.
 * Missing company profile defaults to not requiring a reason.
 *
 * @param {Request} req - Express request with validated update body.
 * @param {Response} res - Express response used for the 400 envelope.
 * @param {NextFunction} next - Continues when the reason policy is satisfied.
 * @returns {Promise<void>}
 */
export const checkReasonForTimeEditMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TUpdateTimeLogPayload;

    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: { requireReasonForTimeEdit: true },
    });

    const requiresReason = profile?.requireReasonForTimeEdit ?? false;
    if (requiresReason && !payload.reason?.trim()) {
      res.status(400).json({
        success: false,
        message: 'A reason is required to edit this time log.',
        errorType: AuthErrorType.BAD_REQUEST,
        traceId,
      });
      return;
    }

    next();
  }
);
