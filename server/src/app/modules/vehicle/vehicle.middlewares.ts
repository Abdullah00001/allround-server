import { NextFunction, Request, Response } from 'express';
import { Vehicle } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TCreateVehiclePayload,
  TUpdateVehiclePayload,
} from '@/app/modules/vehicle/vehicle.types';

/**
 * Resolves a vehicle id from route params or request body.
 *
 * @param {Request} req - Express request.
 * @returns {string | undefined} Vehicle UUID when present.
 */
const resolveVehicleId = (req: Request): string | undefined => {
  if (typeof req.params.id === 'string' && req.params.id.length > 0) {
    return req.params.id;
  }
  const body = req.body as { vehicleId?: unknown } | undefined;
  if (body && typeof body.vehicleId === 'string' && body.vehicleId.length > 0) {
    return body.vehicleId;
  }
  return undefined;
};

/**
 * Verifies that a non-soft-deleted vehicle exists for `req.params.id` or `req.body.vehicleId`.
 * Attaches the Prisma `Vehicle` to `req.vehicle` on success.
 *
 * @param {Request} req - Express request with validated vehicle id in params or body.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the vehicle exists.
 * @returns {Promise<void>}
 */
export const checkVehicleExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const vehicleId = resolveVehicleId(req);

    if (!vehicleId) {
      res.status(404).json({
        success: false,
        message: 'Vehicle not found',
        errorType: AuthErrorType.VEHICLE_NOT_FOUND,
        traceId,
      });
      return;
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        message: 'Vehicle not found',
        errorType: AuthErrorType.VEHICLE_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.vehicle = vehicle as Vehicle;
    next();
  }
);

/**
 * Ensures the create payload plate number is unique.
 * Responds with 409 `PLATE_NUMBER_ALREADY_EXISTS` when a matching row exists.
 *
 * @param {Request} req - Express request with validated create body.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when the plate number is free.
 * @returns {Promise<void>}
 */
export const checkPlateNumberNotExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { plateNumber } = req.body as TCreateVehiclePayload;

    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber },
      select: { id: true },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Vehicle with this plate number already exists',
        errorType: AuthErrorType.PLATE_NUMBER_ALREADY_EXISTS,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Ensures an optional update plate number does not collide with another vehicle.
 * Skips when `plateNumber` is absent or unchanged for the current vehicle.
 *
 * @param {Request} req - Express request with trusted `req.vehicle` and body.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when the plate is free or unchanged.
 * @returns {Promise<void>}
 */
export const checkUpdatePlateNumberNotExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const vehicle = req.vehicle as Vehicle;
    const { plateNumber } = req.body as TUpdateVehiclePayload;

    if (plateNumber === undefined || plateNumber === vehicle.plateNumber) {
      next();
      return;
    }

    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber },
      select: { id: true },
    });

    if (existing && existing.id !== vehicle.id) {
      res.status(409).json({
        success: false,
        message: 'Vehicle with this plate number already exists',
        errorType: AuthErrorType.PLATE_NUMBER_ALREADY_EXISTS,
        traceId,
      });
      return;
    }

    next();
  }
);
