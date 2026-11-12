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
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkNoActiveTimerMiddleware,
  checkOwnedActiveTimeLogMiddleware,
  checkSiteManagerPhaseAccessMiddleware,
  checkSiteManagerRoleMiddleware,
} from '@/app/modules/mobile/mobile.middlewares';
import {
  createManualTimeController,
  getCrewTimeController,
  getDashboardController,
  getMyProjectsController,
  getMyTimeLogsController,
  getProfileController,
  startTimerController,
  stopTimerController,
  syncTimeLogsController,
} from '@/app/modules/mobile/mobile.controllers';
import {
  crewTimePhaseParamsSchema,
  getMyTimeLogsQuerySchema,
  manualTimeSchema,
  startTimerSchema,
  stopTimerSchema,
  syncTimeLogsSchema,
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
  .route('/mobile/crew-time/:phaseId')
  .get(
    ...mobileAuth,
    checkSiteManagerRoleMiddleware,
    validateReqParams(crewTimePhaseParamsSchema),
    checkPhaseExistenceMiddleware,
    checkSiteManagerPhaseAccessMiddleware,
    getCrewTimeController
  );

router
  .route('/mobile/sync')
  .post(
    ...mobileAuth,
    validateReqBody(syncTimeLogsSchema),
    syncTimeLogsController
  );

export default router;
