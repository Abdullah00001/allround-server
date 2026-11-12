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
import {
  checkPlateNumberNotExistsMiddleware,
  checkUpdatePlateNumberNotExistsMiddleware,
  checkVehicleExistenceMiddleware,
} from '@/app/modules/vehicle/vehicle.middlewares';
import {
  createVehicleController,
  deleteVehicleController,
  listVehiclesController,
  updateVehicleController,
} from '@/app/modules/vehicle/vehicle.controllers';
import {
  createVehicleSchema,
  getVehiclesQuerySchema,
  updateVehicleSchema,
  vehicleIdParamsSchema,
} from '@/app/modules/vehicle/vehicle.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all vehicle fleet routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/vehicles')
  .post(
    ...adminAuth,
    validateReqBody(createVehicleSchema),
    checkPlateNumberNotExistsMiddleware,
    createVehicleController
  )
  .get(
    ...adminAuth,
    validateReqQuery(getVehiclesQuerySchema),
    listVehiclesController
  );

router
  .route('/admin/vehicles/:id')
  .patch(
    ...adminAuth,
    validateReqParams(vehicleIdParamsSchema),
    checkVehicleExistenceMiddleware,
    validateReqBody(updateVehicleSchema),
    checkUpdatePlateNumberNotExistsMiddleware,
    updateVehicleController
  )
  .delete(
    ...adminAuth,
    validateReqParams(vehicleIdParamsSchema),
    checkVehicleExistenceMiddleware,
    deleteVehicleController
  );

export default router;
