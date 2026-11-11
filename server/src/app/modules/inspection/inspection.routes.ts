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
  checkInspectionConvertibleMiddleware,
  checkInspectionCustomerExistsMiddleware,
  checkInspectionExistenceMiddleware,
  checkOptionalSiteManagerExistsMiddleware,
} from '@/app/modules/inspection/inspection.middlewares';
import {
  convertInspectionController,
  createInspectionController,
  getInspectionByIdController,
  listInspectionsController,
  updateInspectionController,
} from '@/app/modules/inspection/inspection.controllers';
import {
  convertInspectionSchema,
  createInspectionSchema,
  getInspectionsQuerySchema,
  inspectionIdParamsSchema,
  updateInspectionSchema,
} from '@/app/modules/inspection/inspection.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all inspection CRM routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/inspections')
  .post(
    ...adminAuth,
    validateReqBody(createInspectionSchema),
    checkInspectionCustomerExistsMiddleware,
    checkOptionalSiteManagerExistsMiddleware,
    createInspectionController
  )
  .get(
    ...adminAuth,
    validateReqQuery(getInspectionsQuerySchema),
    listInspectionsController
  );

router
  .route('/admin/inspections/:id')
  .get(
    ...adminAuth,
    validateReqParams(inspectionIdParamsSchema),
    checkInspectionExistenceMiddleware,
    getInspectionByIdController
  )
  .patch(
    ...adminAuth,
    validateReqParams(inspectionIdParamsSchema),
    checkInspectionExistenceMiddleware,
    validateReqBody(updateInspectionSchema),
    checkOptionalSiteManagerExistsMiddleware,
    updateInspectionController
  );

router
  .route('/admin/inspections/:id/convert')
  .post(
    ...adminAuth,
    validateReqParams(inspectionIdParamsSchema),
    checkInspectionExistenceMiddleware,
    checkInspectionConvertibleMiddleware,
    validateReqBody(convertInspectionSchema),
    convertInspectionController
  );

export default router;
