import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TCreateUserPayload,
  TUpdateUserPayload,
} from '@/app/modules/user/user.types';

/**
 * Verifies that a non-soft-deleted managed user exists for `req.params.id`.
 * Attaches the Prisma `User` to `req.managedUser` (does not overwrite admin `req.user`).
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the user exists.
 * @returns {Promise<void>}
 */
export const checkUserExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const userId = req.params.id as string;

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

    req.managedUser = user as User;
    next();
  }
);

/**
 * Ensures the create payload email is not already registered.
 * Responds with 409 `EMAIL_ALREADY_EXISTS` when a matching row exists.
 *
 * @param {Request} req - Express request with validated create body.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when the email is free.
 * @returns {Promise<void>}
 */
export const checkEmailNotExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { email } = req.body as TCreateUserPayload;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        errorType: AuthErrorType.EMAIL_ALREADY_EXISTS,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Ensures an optional update email does not collide with another user.
 * Skips when `email` is absent or unchanged for the managed user.
 *
 * @param {Request} req - Express request with trusted `req.managedUser` and body.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when the email is free or unchanged.
 * @returns {Promise<void>}
 */
export const checkUpdateEmailNotExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const managedUser = req.managedUser as User;
    const { email } = req.body as TUpdateUserPayload;

    if (email === undefined || email === managedUser.email) {
      next();
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && existing.id !== managedUser.id) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        errorType: AuthErrorType.EMAIL_ALREADY_EXISTS,
        traceId,
      });
      return;
    }

    next();
  }
);
