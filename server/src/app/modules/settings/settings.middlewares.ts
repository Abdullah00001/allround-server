import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { comparePassword } from '@/app/utils/password.utils';
import { TChangePasswordPayload } from '@/app/modules/settings/settings.types';

/**
 * Validates current password and rejects reuse of the same password.
 * Unified 400 message (does not reveal which check failed) — same as alua.
 *
 * @param {Request} req - Express request with `req.user` and validated body.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Continues when checks pass.
 * @returns {Promise<void>}
 */
export const checkCurrentPasswordMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const { currentPassword, newPassword } =
      req.body as TChangePasswordPayload;

    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message:
          'Current password is incorrect or new password matches the existing one.',
        traceId,
      });
      return;
    }

    const isSamePassword = await comparePassword(
      newPassword,
      user.passwordHash
    );
    if (isSamePassword) {
      res.status(400).json({
        success: false,
        message:
          'Current password is incorrect or new password matches the existing one.',
        traceId,
      });
      return;
    }

    next();
  }
);
