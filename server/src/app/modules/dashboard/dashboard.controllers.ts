import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { getAdminDashboardService } from '@/app/modules/dashboard/dashboard.services';
import { TGetAdminDashboardQuery } from '@/app/modules/dashboard/dashboard.types';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import { asyncHandler } from '@/app/utils/system.utils';

/**
 * Handles `GET /admin/dashboard`.
 * Returns KPI stats, active map pins, and paginated today's operations.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAdminDashboardController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetAdminDashboardQuery;
    const { data, total, page, limit } = await getAdminDashboardService({
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Dashboard fetched successfully.',
      meta,
      data,
      traceId,
    });
    return;
  }
);
