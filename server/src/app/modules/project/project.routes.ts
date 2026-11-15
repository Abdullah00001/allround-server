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
  checkMobileCreateProjectRefsMiddleware,
  checkMobileProjectExistenceMiddleware,
  checkPhaseBelongsToProjectMiddleware,
  checkProjectAttachmentExistenceMiddleware,
  checkProjectMeasurementExistenceMiddleware,
  checkProjectNoteExistenceMiddleware,
  checkProjectPhotoAttachmentMiddleware,
  checkProjectTaskExistenceMiddleware,
  checkTaskAssigneeExistenceMiddleware,
} from '@/app/modules/mobile/mobile.middlewares';
import {
  createPhaseController,
  createProjectAttachmentController,
  createProjectController,
  createProjectMeasurementController,
  createProjectNoteController,
  createProjectTaskController,
  deleteProjectAttachmentController,
  deleteProjectController,
  deleteProjectMeasurementController,
  deleteProjectNoteController,
  deleteProjectTaskController,
  getProjectByIdController,
  listProjectAttachmentsController,
  listProjectHistoryController,
  listProjectMeasurementsController,
  listProjectNotesController,
  listProjectsController,
  listProjectTasksController,
  setProjectAttachmentCoverController,
  toggleProjectTaskController,
  updatePhaseDatesController,
  updatePhaseStatusController,
  updateProjectController,
  updateProjectMeasurementController,
  updateProjectNoteController,
} from '@/app/modules/project/project.controllers';
import {
  adminProjectChildIdParamsSchema,
  adminProjectIdParamsSchema,
  adminProjectPhaseDatesParamsSchema,
  createAdminProjectSchema,
  createPhaseSchema,
  getProjectsQuerySchema,
  phaseIdParamsSchema,
  projectIdParamsSchema,
  updatePhaseStatusSchema,
  updateProjectSchema,
} from '@/app/modules/project/project.schema';
import {
  createMeasurementSchema,
  createProjectAttachmentSchema,
  createProjectNoteSchema,
  createProjectTaskSchema,
  getProjectAttachmentsQuerySchema,
  getProjectListQuerySchema,
  getProjectTasksQuerySchema,
  mobileTaskIdParamsSchema,
  updateMeasurementSchema,
  updatePhaseDatesSchema,
  updateProjectNoteSchema,
} from '@/app/modules/mobile/mobile.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all project CRM routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

/**
 * Admin project existence via `:projectId` (mobile-compatible param name).
 */
const adminProjectAccess = [
  ...adminAuth,
  validateReqParams(adminProjectIdParamsSchema),
  checkMobileProjectExistenceMiddleware,
] as const;

router
  .route('/admin/projects')
  .get(
    ...adminAuth,
    validateReqQuery(getProjectsQuerySchema),
    listProjectsController
  )
  .post(
    ...adminAuth,
    validateReqBody(createAdminProjectSchema),
    checkMobileCreateProjectRefsMiddleware,
    createProjectController
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
  )
  .delete(
    ...adminAuth,
    validateReqParams(projectIdParamsSchema),
    checkProjectExistenceMiddleware,
    deleteProjectController
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

router
  .route('/admin/projects/:projectId/phases/:phaseId/dates')
  .patch(
    ...adminAuth,
    validateReqParams(adminProjectPhaseDatesParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkPhaseExistenceMiddleware,
    checkPhaseBelongsToProjectMiddleware,
    validateReqBody(updatePhaseDatesSchema),
    updatePhaseDatesController
  );

router
  .route('/admin/projects/:projectId/tasks')
  .get(
    ...adminProjectAccess,
    validateReqQuery(getProjectTasksQuerySchema),
    listProjectTasksController
  )
  .post(
    ...adminProjectAccess,
    validateReqBody(createProjectTaskSchema),
    checkTaskAssigneeExistenceMiddleware,
    createProjectTaskController
  );

router
  .route('/admin/tasks/:taskId/toggle')
  .patch(
    ...adminAuth,
    validateReqParams(mobileTaskIdParamsSchema),
    checkProjectTaskExistenceMiddleware,
    toggleProjectTaskController
  );

router
  .route('/admin/tasks/:taskId')
  .delete(
    ...adminAuth,
    validateReqParams(mobileTaskIdParamsSchema),
    checkProjectTaskExistenceMiddleware,
    deleteProjectTaskController
  );

router
  .route('/admin/projects/:projectId/measurements')
  .get(
    ...adminProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectMeasurementsController
  )
  .post(
    ...adminProjectAccess,
    validateReqBody(createMeasurementSchema),
    createProjectMeasurementController
  );

router
  .route('/admin/projects/:projectId/measurements/:id')
  .patch(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectMeasurementExistenceMiddleware,
    validateReqBody(updateMeasurementSchema),
    updateProjectMeasurementController
  )
  .delete(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectMeasurementExistenceMiddleware,
    deleteProjectMeasurementController
  );

router
  .route('/admin/projects/:projectId/notes')
  .get(
    ...adminProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectNotesController
  )
  .post(
    ...adminProjectAccess,
    validateReqBody(createProjectNoteSchema),
    createProjectNoteController
  );

router
  .route('/admin/projects/:projectId/notes/:id')
  .patch(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectNoteExistenceMiddleware,
    validateReqBody(updateProjectNoteSchema),
    updateProjectNoteController
  )
  .delete(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectNoteExistenceMiddleware,
    deleteProjectNoteController
  );

router
  .route('/admin/projects/:projectId/attachments')
  .get(
    ...adminProjectAccess,
    validateReqQuery(getProjectAttachmentsQuerySchema),
    listProjectAttachmentsController
  )
  .post(
    ...adminProjectAccess,
    validateReqBody(createProjectAttachmentSchema),
    createProjectAttachmentController
  );

router
  .route('/admin/projects/:projectId/attachments/:id/cover')
  .patch(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectAttachmentExistenceMiddleware,
    checkProjectPhotoAttachmentMiddleware,
    setProjectAttachmentCoverController
  );

router
  .route('/admin/projects/:projectId/attachments/:id')
  .delete(
    ...adminAuth,
    validateReqParams(adminProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkProjectAttachmentExistenceMiddleware,
    deleteProjectAttachmentController
  );

router
  .route('/admin/projects/:projectId/history')
  .get(
    ...adminProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectHistoryController
  );

export default router;
