import { Request, Response } from 'express';
import { Vehicle } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  createVehicleService,
  deleteVehicleService,
  listVehiclesService,
  updateVehicleService,
} from '@/app/modules/vehicle/vehicle.services';
import {
  TCreateVehiclePayload,
  TGetVehiclesQuery,
  TUpdateVehiclePayload,
} from '@/app/modules/vehicle/vehicle.types';

/**
 * Handles `POST /admin/vehicles`.
 * Creates a new fleet vehicle.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createVehicleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateVehiclePayload;
    const data = await createVehicleService({ payload });

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/vehicles`.
 * Returns a paginated vehicle list.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listVehiclesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetVehiclesQuery;
    const { items, total, page, limit } = await listVehiclesService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Vehicles fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/vehicles/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.vehicle` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateVehicleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const vehicle = req.vehicle as Vehicle;
    const payload = req.body as TUpdateVehiclePayload;
    const data = await updateVehicleService({ vehicle, payload });

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/vehicles/:id`.
 * Soft-deletes the vehicle. Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.vehicle`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteVehicleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const vehicle = req.vehicle as Vehicle;
    const data = await deleteVehicleService({ vehicle });

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);
