import { Router } from 'express';
import {
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import {
  getDashboardController,
  getMyProjectsController,
  getProfileController,
} from '@/app/modules/mobile/mobile.controllers';

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

export default router;
