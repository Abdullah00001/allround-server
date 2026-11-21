import { Router } from 'express';
import {
  validateReqBody,
  validateReqParams,
  validateReqQuery,
} from '@/app/utils/system.utils';
import {
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import { syncLocaleFromAuthenticatedUserMiddleware } from '@/app/middlewares/locale.middlewares';
import { checkInspectionExistenceMiddleware } from '@/app/modules/inspection/inspection.middlewares';
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkCrewTimeProjectExistenceMiddleware,
  checkEmployeeManualTimeAllowedMiddleware,
  checkInspectionAssignedToSiteManagerMiddleware,
  checkInspectionPendingForSurveyMiddleware,
  checkMobileCreateProjectRefsMiddleware,
  checkMobileProjectExistenceMiddleware,
  checkEmployeeRoleMiddleware,
  checkNoActiveTimerMiddleware,
  checkSiteManagerCreateProjectAllowedMiddleware,
  checkOwnedActiveTimeLogMiddleware,
  resolveTimerPhaseFromProjectMiddleware,
  checkPhaseBelongsToProjectMiddleware,
  checkProjectAttachmentExistenceMiddleware,
  checkProjectMeasurementExistenceMiddleware,
  checkProjectNoteExistenceMiddleware,
  checkProjectPhotoAttachmentMiddleware,
  checkProjectTaskExistenceMiddleware,
  checkSiteManagerPhaseAccessMiddleware,
  checkSiteManagerProjectAccessMiddleware,
  checkSiteManagerRoleMiddleware,
  checkTaskAssigneeExistenceMiddleware,
  mapPhaseIdFromParamsMiddleware,
} from '@/app/modules/mobile/mobile.middlewares';
import {
  completeMobileInspectionController,
  createManualTimeController,
  createMobileProjectController,
  createProjectAttachmentController,
  createProjectMeasurementController,
  createProjectNoteController,
  createProjectTaskController,
  listProjectEmployeesController,
  deleteProjectAttachmentController,
  deleteProjectMeasurementController,
  deleteProjectNoteController,
  deleteProjectTaskController,
  getCrewTimeController,
  getDashboardController,
  getMapController,
  getMobileConfigController,
  getMobileEmployeeDashboardController,
  getMobileInspectionByIdController,
  getMobileProjectByIdController,
  getMyProjectsController,
  getEmployeeScheduleController,
  getEmployeeTimeLogsController,
  getMyTimeLogsController,
  getProfileController,
  getTimeTrackingProjectsController,
  getTimeTrackingSummaryController,
  updateProfileController,
  getScheduleController,
  listMobileCustomersController,
  listMobileInspectionsController,
  listMobilePhasesController,
  listProjectAttachmentsController,
  listProjectHistoryController,
  listProjectMeasurementsController,
  listProjectNotesController,
  listProjectTasksController,
  setProjectAttachmentCoverController,
  startTimerController,
  stopTimerController,
  syncTimeLogsController,
  toggleProjectTaskController,
  updateMobilePhaseStatusController,
  updateMobileProjectController,
  updatePhaseDatesController,
  updateProjectMeasurementController,
  updateProjectNoteController,
} from '@/app/modules/mobile/mobile.controllers';
import {
  completeInspectionSchema,
  createMeasurementSchema,
  createMobileProjectSchema,
  createProjectAttachmentSchema,
  createProjectNoteSchema,
  createProjectTaskSchema,
  getCrewTimeQuerySchema,
  getDashboardQuerySchema,
  getMapQuerySchema,
  getMobileCustomersQuerySchema,
  getMobileInspectionsQuerySchema,
  getMobilePhasesQuerySchema,
  getMyProjectsQuerySchema,
  getMyTimeLogsQuerySchema,
  getProjectAttachmentsQuerySchema,
  getProjectEmployeesQuerySchema,
  getProjectListQuerySchema,
  getProjectTasksQuerySchema,
  getScheduleQuerySchema,
  getTimeTrackingProjectsQuerySchema,
  employeeManualTimeSchema,
  employeeStartTimerSchema,
  manualTimeSchema,
  mobileInspectionIdParamsSchema,
  mobilePhaseIdParamsSchema,
  mobileProjectChildIdParamsSchema,
  mobileProjectIdParamsSchema,
  mobileProjectPhaseDatesParamsSchema,
  mobileTaskIdParamsSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
  updateMeasurementSchema,
  updateMobileProfileSchema,
  updateMobileProjectSchema,
  updatePhaseDatesSchema,
  updatePhaseStatusSchema,
  updateProjectNoteSchema,
} from '@/app/modules/mobile/mobile.schema';

const router = Router();

/**
 * Shared mobile bearer auth chain (no CSRF / admin middleware).
 * After auth, applies `UserPreference.language` to ALS (alua/admin parity)
 * unless the client sent an explicit `x-locale` / `?locale=` override.
 */
const mobileAuth = [
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  syncLocaleFromAuthenticatedUserMiddleware,
] as const;

/**
 * Mobile site-manager auth chain for inspection and phase-board routes.
 */
const siteManagerAuth = [...mobileAuth, checkSiteManagerRoleMiddleware] as const;

/**
 * Employee-only auth chain (My Plan + Time Tracking UI).
 */
const employeeAuth = [...mobileAuth, checkEmployeeRoleMiddleware] as const;

/**
 * Site-manager project access chain for `/:projectId` management routes.
 */
const siteManagerProjectAccess = [
  ...siteManagerAuth,
  validateReqParams(mobileProjectIdParamsSchema),
  checkMobileProjectExistenceMiddleware,
  checkSiteManagerProjectAccessMiddleware,
] as const;

router.route('/mobile/config').get(...mobileAuth, getMobileConfigController);

router
  .route('/mobile/customers')
  .get(
    ...mobileAuth,
    validateReqQuery(getMobileCustomersQuerySchema),
    listMobileCustomersController
  );

router
  .route('/mobile/dashboard')
  .get(
    ...mobileAuth,
    validateReqQuery(getDashboardQuerySchema),
    getDashboardController
  );

router
  .route('/mobile/employee/dashboard')
  .get(
    ...mobileAuth,
    validateReqQuery(getDashboardQuerySchema),
    getMobileEmployeeDashboardController
  );

router
  .route('/mobile/projects')
  .get(
    ...mobileAuth,
    validateReqQuery(getMyProjectsQuerySchema),
    getMyProjectsController
  )
  .post(
    ...siteManagerAuth,
    checkSiteManagerCreateProjectAllowedMiddleware,
    validateReqBody(createMobileProjectSchema),
    checkMobileCreateProjectRefsMiddleware,
    createMobileProjectController
  );

router
  .route('/mobile/projects/:projectId')
  .get(...siteManagerProjectAccess, getMobileProjectByIdController)
  .patch(
    ...siteManagerProjectAccess,
    validateReqBody(updateMobileProjectSchema),
    updateMobileProjectController
  );

router
  .route('/mobile/projects/:projectId/employees')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectEmployeesQuerySchema),
    listProjectEmployeesController
  );

router
  .route('/mobile/projects/:projectId/tasks')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectTasksQuerySchema),
    listProjectTasksController
  )
  .post(
    ...siteManagerProjectAccess,
    validateReqBody(createProjectTaskSchema),
    checkTaskAssigneeExistenceMiddleware,
    createProjectTaskController
  );

router
  .route('/mobile/tasks/:taskId/toggle')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileTaskIdParamsSchema),
    checkProjectTaskExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    toggleProjectTaskController
  );

router
  .route('/mobile/tasks/:taskId')
  .delete(
    ...siteManagerAuth,
    validateReqParams(mobileTaskIdParamsSchema),
    checkProjectTaskExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    deleteProjectTaskController
  );

router
  .route('/mobile/projects/:projectId/measurements')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectMeasurementsController
  )
  .post(
    ...siteManagerProjectAccess,
    validateReqBody(createMeasurementSchema),
    createProjectMeasurementController
  );

router
  .route('/mobile/projects/:projectId/measurements/:id')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectMeasurementExistenceMiddleware,
    validateReqBody(updateMeasurementSchema),
    updateProjectMeasurementController
  )
  .delete(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectMeasurementExistenceMiddleware,
    deleteProjectMeasurementController
  );

router
  .route('/mobile/projects/:projectId/notes')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectNotesController
  )
  .post(
    ...siteManagerProjectAccess,
    validateReqBody(createProjectNoteSchema),
    createProjectNoteController
  );

router
  .route('/mobile/projects/:projectId/notes/:id')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectNoteExistenceMiddleware,
    validateReqBody(updateProjectNoteSchema),
    updateProjectNoteController
  )
  .delete(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectNoteExistenceMiddleware,
    deleteProjectNoteController
  );

router
  .route('/mobile/projects/:projectId/phases/:phaseId/dates')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileProjectPhaseDatesParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkPhaseExistenceMiddleware,
    checkPhaseBelongsToProjectMiddleware,
    validateReqBody(updatePhaseDatesSchema),
    updatePhaseDatesController
  );

router
  .route('/mobile/projects/:projectId/attachments')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectAttachmentsQuerySchema),
    listProjectAttachmentsController
  )
  .post(
    ...siteManagerProjectAccess,
    validateReqBody(createProjectAttachmentSchema),
    createProjectAttachmentController
  );

router
  .route('/mobile/projects/:projectId/history')
  .get(
    ...siteManagerProjectAccess,
    validateReqQuery(getProjectListQuerySchema),
    listProjectHistoryController
  );

router
  .route('/mobile/projects/:projectId/attachments/:id/cover')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectAttachmentExistenceMiddleware,
    checkProjectPhotoAttachmentMiddleware,
    setProjectAttachmentCoverController
  );

router
  .route('/mobile/projects/:projectId/attachments/:id')
  .delete(
    ...siteManagerAuth,
    validateReqParams(mobileProjectChildIdParamsSchema),
    checkMobileProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    checkProjectAttachmentExistenceMiddleware,
    deleteProjectAttachmentController
  );

router
  .route('/mobile/profile')
  .get(...mobileAuth, getProfileController)
  .patch(
    ...mobileAuth,
    validateReqBody(updateMobileProfileSchema),
    updateProfileController
  );

/**
 * ---------------------------------------------------------------------------
 * Site Manager / shared timer + schedule (unchanged contracts)
 * ---------------------------------------------------------------------------
 */
router
  .route('/mobile/timer/start')
  .post(
    ...mobileAuth,
    validateReqBody(startTimerSchema),
    checkNoActiveTimerMiddleware,
    checkPhaseExistenceMiddleware,
    startTimerController
  );

router
  .route('/mobile/timer/stop')
  .post(
    ...mobileAuth,
    validateReqBody(stopTimerSchema),
    checkOwnedActiveTimeLogMiddleware,
    stopTimerController
  );

router
  .route('/mobile/timer/manual')
  .post(
    ...mobileAuth,
    checkEmployeeManualTimeAllowedMiddleware,
    validateReqBody(manualTimeSchema),
    checkPhaseExistenceMiddleware,
    createManualTimeController
  );

router
  .route('/mobile/time-logs')
  .get(
    ...mobileAuth,
    validateReqQuery(getMyTimeLogsQuerySchema),
    getMyTimeLogsController
  );

router
  .route('/mobile/schedule')
  .get(
    ...siteManagerAuth,
    validateReqQuery(getScheduleQuerySchema),
    getScheduleController
  );

/**
 * ---------------------------------------------------------------------------
 * Employee-only flow (My Plan + Time Tracking UI)
 * ---------------------------------------------------------------------------
 */
router
  .route('/mobile/employee/schedule')
  .get(
    ...employeeAuth,
    validateReqQuery(getScheduleQuerySchema),
    getEmployeeScheduleController
  );

router
  .route('/mobile/employee/time-tracking/summary')
  .get(...employeeAuth, getTimeTrackingSummaryController);

router
  .route('/mobile/employee/time-tracking/projects')
  .get(
    ...employeeAuth,
    validateReqQuery(getTimeTrackingProjectsQuerySchema),
    getTimeTrackingProjectsController
  );

router
  .route('/mobile/employee/timer/start')
  .post(
    ...employeeAuth,
    validateReqBody(employeeStartTimerSchema),
    checkNoActiveTimerMiddleware,
    resolveTimerPhaseFromProjectMiddleware,
    checkPhaseExistenceMiddleware,
    startTimerController
  );

router
  .route('/mobile/employee/timer/stop')
  .post(
    ...employeeAuth,
    validateReqBody(stopTimerSchema),
    checkOwnedActiveTimeLogMiddleware,
    stopTimerController
  );

router
  .route('/mobile/employee/timer/manual')
  .post(
    ...employeeAuth,
    checkEmployeeManualTimeAllowedMiddleware,
    validateReqBody(employeeManualTimeSchema),
    resolveTimerPhaseFromProjectMiddleware,
    checkPhaseExistenceMiddleware,
    createManualTimeController
  );

router
  .route('/mobile/employee/time-logs')
  .get(
    ...employeeAuth,
    validateReqQuery(getMyTimeLogsQuerySchema),
    getEmployeeTimeLogsController
  );

router
  .route('/mobile/map')
  .get(
    ...siteManagerAuth,
    validateReqQuery(getMapQuerySchema),
    getMapController
  );

router
  .route('/mobile/crew-time')
  .get(
    ...siteManagerAuth,
    validateReqQuery(getCrewTimeQuerySchema),
    checkCrewTimeProjectExistenceMiddleware,
    checkSiteManagerProjectAccessMiddleware,
    getCrewTimeController
  );

router
  .route('/mobile/sync')
  .post(
    ...mobileAuth,
    validateReqBody(syncTimeLogsSchema),
    syncTimeLogsController
  );

router
  .route('/mobile/inspections')
  .get(
    ...siteManagerAuth,
    validateReqQuery(getMobileInspectionsQuerySchema),
    listMobileInspectionsController
  );

router
  .route('/mobile/inspections/:id')
  .get(
    ...siteManagerAuth,
    validateReqParams(mobileInspectionIdParamsSchema),
    checkInspectionExistenceMiddleware,
    checkInspectionAssignedToSiteManagerMiddleware,
    getMobileInspectionByIdController
  );

router
  .route('/mobile/inspections/:id/complete')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobileInspectionIdParamsSchema),
    checkInspectionExistenceMiddleware,
    checkInspectionAssignedToSiteManagerMiddleware,
    checkInspectionPendingForSurveyMiddleware,
    validateReqBody(completeInspectionSchema),
    completeMobileInspectionController
  );

router
  .route('/mobile/phases')
  .get(
    ...siteManagerAuth,
    validateReqQuery(getMobilePhasesQuerySchema),
    listMobilePhasesController
  );

router
  .route('/mobile/phases/:id/status')
  .patch(
    ...siteManagerAuth,
    validateReqParams(mobilePhaseIdParamsSchema),
    mapPhaseIdFromParamsMiddleware,
    checkPhaseExistenceMiddleware,
    checkSiteManagerPhaseAccessMiddleware,
    validateReqBody(updatePhaseStatusSchema),
    updateMobilePhaseStatusController
  );

export default router;
