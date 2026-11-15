import { Request, Response } from 'express';
import {
  CrewAssignment,
  ProjectPhase,
  User,
  Vehicle,
  VehicleAssignment,
} from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  assignCrewService,
  assignVehicleService,
  getAvailableResourcesService,
  getDailyPlanService,
  getWeeklyPlanService,
  unassignCrewService,
  unassignVehicleService,
} from '@/app/modules/planning/planning.services';
import {
  TAssignCrewPayload,
  TAssignVehiclePayload,
  TGetAvailableResourcesQuery,
  TGetDailyPlanQuery,
  TGetWeeklyPlanQuery,
} from '@/app/modules/planning/planning.types';

/**
 * Handles `GET /admin/plannings/daily`.
 * Returns phase cards for the requested calendar date.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getDailyPlanController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetDailyPlanQuery;
    const data = await getDailyPlanService({ query });

    res.status(200).json({
      success: true,
      message: 'Daily plan fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/plannings/assign-crew`.
 * Relies on phase/user existence middlewares for 404 handling.
 *
 * @param {Request} req - Express request with trusted phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const assignCrewController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TAssignCrewPayload;
    const data = await assignCrewService({ payload, phase });

    res.status(201).json({
      success: true,
      message: 'Crew assigned successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/plannings/assign-vehicle`.
 * Relies on phase/user/vehicle existence and availability middlewares.
 *
 * @param {Request} req - Express request with trusted entities and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const assignVehicleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const phase = req.phase as ProjectPhase;
    const vehicle = req.vehicle as Vehicle;
    const user = req.planningUser as User;
    const payload = req.body as TAssignVehiclePayload;
    const data = await assignVehicleService({
      payload,
      phase,
      vehicle,
      user,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle assigned successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/plannings/available-resources`.
 * Returns employees and vehicles free for the requested date.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAvailableResourcesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetAvailableResourcesQuery;
    const data = await getAvailableResourcesService({ query });

    res.status(200).json({
      success: true,
      message: 'Available resources fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/plannings/crew-assignments/:id`.
 *
 * @param {Request} req - Express request with trusted `req.crewAssignment`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const unassignCrewController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const crewAssignment = req.crewAssignment as CrewAssignment;
    const data = await unassignCrewService({ crewAssignment });

    res.status(200).json({
      success: true,
      message: 'Crew assignment removed successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/plannings/vehicle-assignments/:id`.
 *
 * @param {Request} req - Express request with trusted `req.vehicleAssignment`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const unassignVehicleController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const vehicleAssignment = req.vehicleAssignment as VehicleAssignment;
    const data = await unassignVehicleService({ vehicleAssignment });

    res.status(200).json({
      success: true,
      message: 'Vehicle assignment removed successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/plannings/weekly`.
 * Returns the weekly workforce utilization grid.
 *
 * @param {Request} req - Express request with validated query.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getWeeklyPlanController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetWeeklyPlanQuery;
    const data = await getWeeklyPlanService({ query });

    res.status(200).json({
      success: true,
      message: 'Weekly plan fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

