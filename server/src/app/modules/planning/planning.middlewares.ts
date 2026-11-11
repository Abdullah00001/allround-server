import { NextFunction, Request, Response } from 'express';
import { User, Vehicle } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TAssignCrewPayload,
  TAssignVehiclePayload,
  TGetAvailableResourcesQuery,
} from '@/app/modules/planning/planning.types';
import { toUtcDayDate } from '@/app/modules/planning/planning.helpers';

/**
 * Verifies that `req.body.userId` references a non-deleted user.
 * Attaches the user to `req.planningUser` on success (does not overwrite admin `req.user`).
 *
 * @param {Request} req - Express request with validated body `userId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the user exists.
 * @returns {Promise<void>}
 */
export const checkPlanningUserExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { userId } = req.body as TAssignCrewPayload | TAssignVehiclePayload;

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

    req.planningUser = user as User;
    next();
  }
);

/**
 * Verifies that `req.body.vehicleId` references a non-deleted vehicle.
 * Attaches the vehicle to `req.vehicle` on success.
 *
 * @param {Request} req - Express request with validated body `vehicleId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the vehicle exists.
 * @returns {Promise<void>}
 */
export const checkVehicleExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { vehicleId } = req.body as TAssignVehiclePayload;

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
 * Ensures the vehicle is not already assigned on the requested calendar date.
 * Must run after body validation and vehicle existence checks.
 *
 * @param {Request} req - Express request with validated assign-vehicle body.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when the vehicle is free that day.
 * @returns {Promise<void>}
 */
export const checkVehicleAvailableForDateMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { vehicleId, date } = req.body as TAssignVehiclePayload;
    const dayDate = toUtcDayDate(date);

    const existing = await prisma.vehicleAssignment.findUnique({
      where: {
        vehicleId_date: {
          vehicleId,
          date: dayDate,
        },
      },
      select: { id: true },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Vehicle is already assigned on this date',
        errorType: AuthErrorType.VEHICLE_ALREADY_ASSIGNED,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * When `phaseId` is present on the available-resources query, verifies the phase exists
 * and attaches it to `req.phase`. Skips when `phaseId` is omitted.
 *
 * @param {Request} req - Express request with validated query.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when valid or when phaseId is absent.
 * @returns {Promise<void>}
 */
export const checkOptionalPhaseQueryMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetAvailableResourcesQuery;
    if (!query.phaseId) {
      next();
      return;
    }

    const phase = await prisma.projectPhase.findUnique({
      where: { id: query.phaseId },
    });

    if (!phase) {
      res.status(404).json({
        success: false,
        message: 'Phase not found',
        errorType: AuthErrorType.PHASE_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.phase = phase;
    next();
  }
);
