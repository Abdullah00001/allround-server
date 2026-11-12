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
import { checkInspectionExistenceMiddleware } from '@/app/modules/inspection/inspection.middlewares';
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkCrewTimeProjectExistenceMiddleware,
  checkInspectionAssignedToSiteManagerMiddleware,
  checkInspectionPendingForSurveyMiddleware,
  checkNoActiveTimerMiddleware,
  checkOwnedActiveTimeLogMiddleware,
  checkSiteManagerPhaseAccessMiddleware,
  checkSiteManagerProjectAccessMiddleware,
  checkSiteManagerRoleMiddleware,
  mapPhaseIdFromParamsMiddleware,
} from '@/app/modules/mobile/mobile.middlewares';
import {
  completeMobileInspectionController,
  createManualTimeController,
  getCrewTimeController,
  getDashboardController,
  getMapController,
  getMobileInspectionByIdController,
  getMyProjectsController,
  getMyTimeLogsController,
  getProfileController,
  getScheduleController,
  listMobileInspectionsController,
  listMobilePhasesController,
  startTimerController,
  stopTimerController,
  syncTimeLogsController,
  updateMobilePhaseStatusController,
} from '@/app/modules/mobile/mobile.controllers';
import {
  completeInspectionSchema,
  getCrewTimeQuerySchema,
  getMapQuerySchema,
  getMyTimeLogsQuerySchema,
  getScheduleQuerySchema,
  manualTimeSchema,
  mobileInspectionIdParamsSchema,
  mobilePhaseIdParamsSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
  updatePhaseStatusSchema,
} from '@/app/modules/mobile/mobile.schema';

const router = Router();

/**
 * Shared mobile bearer auth chain (no CSRF / admin middleware).
 * Mirrors the authenticated mobile session validation used by `/auth/logout`.
 */
const mobileAuth = [
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
  checkAccountStatus,
  checkDeviceSessionMiddleware,
] as const;

/**
 * Mobile site-manager auth chain for inspection and phase-board routes.
 */
const siteManagerAuth = [...mobileAuth, checkSiteManagerRoleMiddleware] as const;

router.route('/mobile/dashboard').get(...mobileAuth, getDashboardController);

router.route('/mobile/projects').get(...mobileAuth, getMyProjectsController);

router.route('/mobile/profile').get(...mobileAuth, getProfileController);

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
  .get(...siteManagerAuth, listMobileInspectionsController);

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
  .get(...siteManagerAuth, listMobilePhasesController);

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
