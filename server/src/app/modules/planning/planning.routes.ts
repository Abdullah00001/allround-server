import { Router } from 'express';
import {
  validateReqBody,
  validateReqQuery,
} from '@/app/utils/system.utils';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkOptionalPhaseQueryMiddleware,
  checkPlanningUserExistenceMiddleware,
  checkVehicleAvailableForDateMiddleware,
  checkVehicleExistenceMiddleware,
} from '@/app/modules/planning/planning.middlewares';
import {
  assignCrewController,
  assignVehicleController,
  getAvailableResourcesController,
  getDailyPlanController,
} from '@/app/modules/planning/planning.controllers';
import {
  assignCrewSchema,
  assignVehicleSchema,
  getAvailableResourcesQuerySchema,
  getDailyPlanQuerySchema,
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

export default router;
