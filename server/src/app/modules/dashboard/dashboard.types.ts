import { z } from 'zod';
import { getAdminDashboardQuerySchema } from '@/app/modules/dashboard/dashboard.schema';

/**
 * Validated admin dashboard query (`page` / `limit` for today's operations).
 */
export type TGetAdminDashboardQuery = z.infer<
  typeof getAdminDashboardQuerySchema
>;

/**
 * Service params for the admin home dashboard aggregate.
 */
export type TGetAdminDashboardServiceParams = {
  /** Validated page/limit for `todaysOperations`. */
  query: TGetAdminDashboardQuery;
};
