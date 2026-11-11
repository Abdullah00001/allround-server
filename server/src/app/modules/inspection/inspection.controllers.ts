import { Request, Response } from 'express';
import { Inspection } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  convertInspectionToProjectService,
  createInspectionService,
  getInspectionByIdService,
  listInspectionsService,
  updateInspectionService,
} from '@/app/modules/inspection/inspection.services';
import {
  TConvertInspectionPayload,
  TCreateInspectionPayload,
  TGetInspectionsQuery,
  TUpdateInspectionPayload,
} from '@/app/modules/inspection/inspection.types';

/**
 * Handles `POST /admin/inspections`.
 * Creates a new inspection and returns a 201 success envelope.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createInspectionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateInspectionPayload;
    const data = await createInspectionService({ payload });

    res.status(201).json({
      success: true,
      message: 'Inspection created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/inspections`.
 * Returns a paginated inspection list with meta links.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listInspectionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetInspectionsQuery;
    const { items, total, page, limit } = await listInspectionsService({
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Inspections fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/inspections/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.inspection`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getInspectionByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;
    const data = await getInspectionByIdService({ inspection });

    res.status(200).json({
      success: true,
      message: 'Inspection fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/inspections/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.inspection` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateInspectionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;
    const payload = req.body as TUpdateInspectionPayload;
    const data = await updateInspectionService({ inspection, payload });

    res.status(200).json({
      success: true,
      message: 'Inspection updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/inspections/:id/convert`.
 * Relies on existence + convertible middlewares for 404/409 handling.
 *
 * @param {Request} req - Express request with trusted `req.inspection` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const convertInspectionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;
    const payload = req.body as TConvertInspectionPayload;
    const data = await convertInspectionToProjectService({
      inspection,
      payload,
    });

    res.status(201).json({
      success: true,
      message: 'Inspection converted to project successfully.',
      data,
      traceId,
    });
    return;
  }
);
