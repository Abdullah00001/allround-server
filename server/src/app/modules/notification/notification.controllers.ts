import { Request, Response } from 'express';
import { Notification, User } from '@prisma/client';

import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  getNotificationsService,
  markAllAsReadService,
  markAsReadService,
} from '@/app/modules/notification/notification.services';
import { TGetNotificationsQuery } from '@/app/modules/notification/notification.types';

/**
 * Handles `GET /mobile|admin/notifications`.
 * Returns a paginated notification list plus `unreadCount`.
 *
 * @param {Request} req - Express request with authenticated user and query.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getNotificationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const query = req.validatedQuery as TGetNotificationsQuery;

    const result = await getNotificationsService({
      userId: user.id,
      page: query?.page,
      limit: query?.limit,
    });

    const meta = buildPaginationMeta({
      total: result.total,
      page: result.page,
      limit: result.limit,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      meta,
      data: {
        items: result.data,
        unreadCount: result.unreadCount,
      },
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile|admin/notifications/:id/read`.
 * Relies on ownership middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.notification`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const markAsReadController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const notification = req.notification as Notification;
    const data = await markAsReadService({ notification });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /mobile|admin/notifications/read-all`.
 * Marks every unread notification for the authenticated user as read.
 *
 * @param {Request} req - Express request with authenticated user.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const markAllAsReadController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await markAllAsReadService({ userId: user.id });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data,
      traceId,
    });
    return;
  }
);
