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
  checkPhaseExistenceMiddleware,
  checkProjectExistenceMiddleware,
} from '@/app/modules/project/project.middlewares';
import {
  createPhaseController,
  getProjectByIdController,
  listProjectsController,
  updatePhaseStatusController,
  updateProjectController,
} from '@/app/modules/project/project.controllers';
import {
  createPhaseSchema,
  getProjectsQuerySchema,
  phaseIdParamsSchema,
  projectIdParamsSchema,
  updatePhaseStatusSchema,
  updateProjectSchema,
} from '@/app/modules/project/project.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all project CRM routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/projects')
  .get(
    ...adminAuth,
    validateReqQuery(getProjectsQuerySchema),
    listProjectsController
  );

router
  .route('/admin/projects/:id')
  .get(
    ...adminAuth,
    validateReqParams(projectIdParamsSchema),
    checkProjectExistenceMiddleware,
    getProjectByIdController
  )
  .patch(
    ...adminAuth,
    validateReqParams(projectIdParamsSchema),
    checkProjectExistenceMiddleware,
    validateReqBody(updateProjectSchema),
    updateProjectController
  );

router
  .route('/admin/projects/:id/phases')
  .post(
    ...adminAuth,
    validateReqParams(projectIdParamsSchema),
    checkProjectExistenceMiddleware,
    validateReqBody(createPhaseSchema),
    createPhaseController
  );

router
  .route('/admin/phases/:phaseId/status')
  .patch(
    ...adminAuth,
    validateReqParams(phaseIdParamsSchema),
    checkPhaseExistenceMiddleware,
    validateReqBody(updatePhaseStatusSchema),
    updatePhaseStatusController
  );

export default router;
