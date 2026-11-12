import { Request, Response } from 'express';
import { TimeLog } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  approveTimeLogService,
  createTimeLogService,
  deleteTimeLogService,
  listTimeLogsService,
  rejectTimeLogService,
  updateTimeLogService,
} from '@/app/modules/timelog/timelog.services';
import {
  TCreateTimeLogPayload,
  TGetTimeLogsQuery,
  TUpdateTimeLogPayload,
} from '@/app/modules/timelog/timelog.types';

/**
 * Handles `GET /admin/time-logs`.
 * Returns a paginated time-log list with nested user/phase and netHours.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listTimeLogsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetTimeLogsQuery;
    const { items, total, page, limit } = await listTimeLogsService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Time logs fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/time-logs`.
 * Creates a manual approved time log.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createTimeLogController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateTimeLogPayload;
    const data = await createTimeLogService({ payload });

    res.status(201).json({
      success: true,
      message: 'Time log created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/time-logs/:id/approve`.
 * Relies on existence + pending middlewares for 404/400 handling.
 *
 * @param {Request} req - Express request with trusted `req.timeLog`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const approveTimeLogController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;
    const data = await approveTimeLogService({ timeLog });

    res.status(200).json({
      success: true,
      message: 'Time log approved successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/time-logs/:id/reject`.
 * Relies on existence + pending middlewares for 404/400 handling.
 *
 * @param {Request} req - Express request with trusted `req.timeLog`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const rejectTimeLogController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;
    const data = await rejectTimeLogService({ timeLog });

    res.status(200).json({
      success: true,
      message: 'Time log rejected successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/time-logs/:id`.
 * Relies on existence + optional reason-policy middlewares.
 *
 * @param {Request} req - Express request with trusted `req.timeLog` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateTimeLogController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;
    const payload = req.body as TUpdateTimeLogPayload;
    const data = await updateTimeLogService({ timeLog, payload });

    res.status(200).json({
      success: true,
      message: 'Time log updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/time-logs/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.timeLog`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteTimeLogController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const timeLog = req.timeLog as TimeLog;
    const data = await deleteTimeLogService({ timeLog });

    res.status(200).json({
      success: true,
      message: 'Time log deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);
