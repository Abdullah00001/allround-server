import { Router } from 'express';
import {
  validateReqBody,
  validateReqParams,
  validateReqQuery,
} from '@/app/utils/system.utils';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkCrewAssignmentExistenceMiddleware,
  checkOptionalPhaseQueryMiddleware,
  checkPlanningUserExistenceMiddleware,
  checkVehicleAssignmentExistenceMiddleware,
  checkVehicleAvailableForDateMiddleware,
} from '@/app/modules/planning/planning.middlewares';
import { checkVehicleExistenceMiddleware } from '@/app/modules/vehicle/vehicle.middlewares';
import {
  assignCrewController,
  assignVehicleController,
  getAvailableResourcesController,
  getDailyPlanController,
  getWeeklyPlanController,
  unassignCrewController,
  unassignVehicleController,
} from '@/app/modules/planning/planning.controllers';
import {
  assignCrewSchema,
  assignVehicleSchema,
  getAvailableResourcesQuerySchema,
  getDailyPlanQuerySchema,
  getWeeklyPlanQuerySchema,
  unassignParamsSchema,
} from '@/app/modules/planning/planning.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all planning routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/plannings/daily')
  .get(
    ...adminAuth,
    validateReqQuery(getDailyPlanQuerySchema),
    getDailyPlanController
  );

router
  .route('/admin/plannings/available-resources')
  .get(
    ...adminAuth,
    validateReqQuery(getAvailableResourcesQuerySchema),
    checkOptionalPhaseQueryMiddleware,
    getAvailableResourcesController
  );

router
  .route('/admin/plannings/assign-crew')
  .post(
    ...adminAuth,
    validateReqBody(assignCrewSchema),
    checkPhaseExistenceMiddleware,
    checkPlanningUserExistenceMiddleware,
    assignCrewController
  );

router
  .route('/admin/plannings/assign-vehicle')
  .post(
    ...adminAuth,
    validateReqBody(assignVehicleSchema),
    checkPhaseExistenceMiddleware,
    checkPlanningUserExistenceMiddleware,
    checkVehicleExistenceMiddleware,
    checkVehicleAvailableForDateMiddleware,
    assignVehicleController
  );

router
  .route('/admin/plannings/weekly')
  .get(
    ...adminAuth,
    validateReqQuery(getWeeklyPlanQuerySchema),
    getWeeklyPlanController
  );

router
  .route('/admin/plannings/crew-assignments/:id')
  .delete(
    ...adminAuth,
    validateReqParams(unassignParamsSchema),
    checkCrewAssignmentExistenceMiddleware,
    unassignCrewController
  );

router
  .route('/admin/plannings/vehicle-assignments/:id')
  .delete(
    ...adminAuth,
    validateReqParams(unassignParamsSchema),
    checkVehicleAssignmentExistenceMiddleware,
    unassignVehicleController
  );

export default router;
