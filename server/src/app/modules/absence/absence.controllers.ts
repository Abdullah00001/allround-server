import { Request, Response } from 'express';
import { Absence } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  createAbsenceService,
  deleteAbsenceService,
  listAbsencesService,
} from '@/app/modules/absence/absence.services';
import {
  TCreateAbsencePayload,
  TGetAbsencesQuery,
} from '@/app/modules/absence/absence.types';

/**
 * Handles `GET /admin/absences`.
 * Returns a paginated absence list with nested user data.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listAbsencesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetAbsencesQuery;
    const { items, total, page, limit } = await listAbsencesService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Absences fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/absences`.
 * Creates a new absence after user-existence middleware.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createAbsenceController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateAbsencePayload;
    const data = await createAbsenceService({ payload });

    res.status(201).json({
      success: true,
      message: 'Absence created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/absences/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.absence`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteAbsenceController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const absence = req.absence as Absence;
    const data = await deleteAbsenceService({ absence });

    res.status(200).json({
      success: true,
      message: 'Absence deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);
