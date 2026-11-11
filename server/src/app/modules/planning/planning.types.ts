import { z } from 'zod';
import { ProjectPhase, User, Vehicle } from '@prisma/client';
import {
  assignCrewSchema,
  assignVehicleSchema,
  getAvailableResourcesQuerySchema,
  getDailyPlanQuerySchema,
} from '@/app/modules/planning/planning.schema';

/**
 * Validated daily-plan query.
 */
export type TGetDailyPlanQuery = z.infer<typeof getDailyPlanQuerySchema>;

/**
 * Validated assign-crew request body.
 */
export type TAssignCrewPayload = z.infer<typeof assignCrewSchema>;

/**
 * Validated assign-vehicle request body.
 */
export type TAssignVehiclePayload = z.infer<typeof assignVehicleSchema>;

/**
 * Validated available-resources query.
 */
export type TGetAvailableResourcesQuery = z.infer<
  typeof getAvailableResourcesQuerySchema
>;

/**
 * Service params for loading the daily plan.
 */
export type TGetDailyPlanServiceParams = {
  /** Validated query containing the calendar date. */
  query: TGetDailyPlanQuery;
};

/**
 * Service params for assigning a crew member.
 */
export type TAssignCrewServiceParams = {
  /** Validated assign-crew payload. */
  payload: TAssignCrewPayload;
  /** Trusted phase already verified by middleware. */
  phase: ProjectPhase;
};

/**
 * Service params for assigning a vehicle.
 */
export type TAssignVehicleServiceParams = {
  /** Validated assign-vehicle payload. */
  payload: TAssignVehiclePayload;
  /** Trusted phase already verified by middleware. */
  phase: ProjectPhase;
  /** Trusted vehicle already verified by middleware. */
  vehicle: Vehicle;
  /** Trusted user already verified by middleware. */
  user: User;
};

/**
 * Service params for listing available resources.
 */
export type TGetAvailableResourcesServiceParams = {
  /** Validated available-resources query. */
  query: TGetAvailableResourcesQuery;
};
