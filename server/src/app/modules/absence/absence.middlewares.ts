import { NextFunction, Request, Response } from 'express';
import { Absence, User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import { TCreateAbsencePayload } from '@/app/modules/absence/absence.types';

/**
 * Verifies that an absence exists for `req.params.id`.
 * Attaches the Prisma `Absence` to `req.absence` on success.
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the absence exists.
 * @returns {Promise<void>}
 */
export const checkAbsenceExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const absenceId = req.params.id as string;

    const absence = await prisma.absence.findUnique({
      where: { id: absenceId },
    });

    if (!absence) {
      res.status(404).json({
        success: false,
        message: 'Absence not found',
        errorType: AuthErrorType.ABSENCE_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.absence = absence as Absence;
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
export const checkAbsenceUserExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { userId } = req.body as TCreateAbsencePayload;

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
