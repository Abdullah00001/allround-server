import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  getDashboardDataService,
  getMyProjectsService,
  getProfileStatsService,
} from '@/app/modules/mobile/mobile.services';

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
