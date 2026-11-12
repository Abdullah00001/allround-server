import { z } from 'zod';
import { Vehicle } from '@prisma/client';
import {
  createVehicleSchema,
  getVehiclesQuerySchema,
  updateVehicleSchema,
} from '@/app/modules/vehicle/vehicle.schema';

/**
 * Validated create-vehicle request body.
 */
export type TCreateVehiclePayload = z.infer<typeof createVehicleSchema>;

/**
 * Validated update-vehicle request body.
 */
export type TUpdateVehiclePayload = z.infer<typeof updateVehicleSchema>;

/**
 * Validated list-vehicles query string.
 */
export type TGetVehiclesQuery = z.infer<typeof getVehiclesQuerySchema>;

/**
 * Service params for creating a vehicle.
 */
export type TCreateVehicleServiceParams = {
  /** Validated create payload. */
  payload: TCreateVehiclePayload;
};

/**
 * Service params for listing vehicles.
 */
export type TListVehiclesServiceParams = {
  /** Validated list query. */
  query: TGetVehiclesQuery;
};

/**
 * Service params for updating a vehicle.
 */
export type TUpdateVehicleServiceParams = {
  /** Trusted non-deleted vehicle from existence middleware. */
  vehicle: Vehicle;
  /** Validated partial update payload. */
  payload: TUpdateVehiclePayload;
};

/**
 * Service params for soft-deleting a vehicle.
 */
export type TDeleteVehicleServiceParams = {
  /** Trusted non-deleted vehicle from existence middleware. */
  vehicle: Vehicle;
};
