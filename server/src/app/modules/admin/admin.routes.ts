import { Router } from 'express';
import { validateReqBody } from '@/app/utils/system.utils';
import {
  adminLoginSchema,
  changeAdminPasswordSchema,
  updateAdminProfileSchema,
} from '@/app/modules/admin/admin.schema';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminAccountStatus,
  checkAdminCurrentPassword,
  checkAdminExistenceMiddleware,
  checkAdminPassword,
  checkAdminRefreshTokenMiddleware,
  checkCsrfTokenMiddleware,
  findAdminForLoginByEmail,
} from '@/app/modules/admin/admin.middlewares';
import {
  changeAdminPasswordController,
  checkAdminController,
  getAdminProfileController,
  loginAdminController,
  logoutAdminController,
  refreshAdminController,
  updateAdminProfileController,
} from '@/app/modules/admin/admin.controllers';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/auth/login')
  .post(
    validateReqBody(adminLoginSchema),
    findAdminForLoginByEmail,
    checkAdminPassword,
    checkAdminAccountStatus,
    loginAdminController
  );

router
  .route('/admin/auth/check')
  .post(
    checkCsrfTokenMiddleware,
    checkAdminAccessTokenMiddleware,
    checkAdminExistenceMiddleware,
    checkAdminController
  );

router
  .route('/admin/auth/refresh')
  .post(
    checkCsrfTokenMiddleware,
    checkAdminRefreshTokenMiddleware,
    checkAdminExistenceMiddleware,
    refreshAdminController
  );

router
  .route('/admin/auth/logout')
  .post(
    checkCsrfTokenMiddleware,
    checkAdminAccessTokenMiddleware,
    checkAdminExistenceMiddleware,
    logoutAdminController
  );

router
  .route('/admin/profile')
  .get(...adminAuth, getAdminProfileController)
  .patch(
    ...adminAuth,
    validateReqBody(updateAdminProfileSchema),
    updateAdminProfileController
  );

/**
 * Change admin password (alua-compatible). Clears all Redis sessions + cookies.
 */
router
  .route('/admin/settings/password')
  .post(
    ...adminAuth,
    validateReqBody(changeAdminPasswordSchema),
    checkAdminCurrentPassword,
    changeAdminPasswordController
  );

export default router;
