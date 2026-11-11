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
  checkAbsenceExistenceMiddleware,
  checkAbsenceUserExistenceMiddleware,
} from '@/app/modules/absence/absence.middlewares';
import {
  createAbsenceController,
  deleteAbsenceController,
  listAbsencesController,
} from '@/app/modules/absence/absence.controllers';
import {
  absenceIdParamsSchema,
  createAbsenceSchema,
  getAbsencesQuerySchema,
} from '@/app/modules/absence/absence.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all absence routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/absences')
  .get(
    ...adminAuth,
    validateReqQuery(getAbsencesQuerySchema),
    listAbsencesController
  )
  .post(
    ...adminAuth,
    validateReqBody(createAbsenceSchema),
    checkAbsenceUserExistenceMiddleware,
    createAbsenceController
  );

router
  .route('/admin/absences/:id')
  .delete(
    ...adminAuth,
    validateReqParams(absenceIdParamsSchema),
    checkAbsenceExistenceMiddleware,
    deleteAbsenceController
  );

export default router;
