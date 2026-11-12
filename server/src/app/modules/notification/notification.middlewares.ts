import { NextFunction, Request, Response } from 'express';
import { Notification, User } from '@prisma/client';

import prisma from '@/app/configs/db.configs';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { AuthErrorType } from '@/const';

/**
 * Ensures `req.params.id` is a notification owned by the authenticated user.
 * Attaches the Prisma row to `req.notification` on success.
 *
 * @param {Request} req - Express request with authenticated `req.user`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the notification exists.
 * @returns {Promise<void>}
 */
export const checkNotificationOwnershipMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const notificationId = req.params.id as string;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found',
        errorType: AuthErrorType.NOTIFICATION_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.notification = notification as Notification;
    next();
  }
);
