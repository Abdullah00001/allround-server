import { Router } from 'express';
import { validateReqBody } from '@/app/utils/system.utils';
import {
  adminLoginSchema,
  changeAdminPasswordSchema,
  updateAdminCompanySettingsSchema,
  updateAdminLanguagesSchema,
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
  exportAdminCustomersController,
  exportAdminProjectsController,
  exportAdminTimeLogsController,
  getAdminCompanySettingsController,
  getAdminLanguagesController,
  getAdminProfileController,
  loginAdminController,
  logoutAdminController,
  refreshAdminController,
  updateAdminCompanySettingsController,
  updateAdminLanguagesController,
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

/**
 * Company branding + access policies (Settings → General / Access policies).
 */
router
  .route('/admin/settings/company')
  .get(...adminAuth, getAdminCompanySettingsController)
  .patch(
    ...adminAuth,
    validateReqBody(updateAdminCompanySettingsSchema),
    updateAdminCompanySettingsController
  );

/**
 * Available languages settings (all 18 + company default/enabled).
 */
router
  .route('/admin/settings/languages')
  .get(...adminAuth, getAdminLanguagesController)
  .patch(
    ...adminAuth,
    validateReqBody(updateAdminLanguagesSchema),
    updateAdminLanguagesController
  );

/**
 * Settings → Data & local reset → Export company data (CSV downloads).
 */
router
  .route('/admin/settings/export/projects')
  .get(...adminAuth, exportAdminProjectsController);

router
  .route('/admin/settings/export/customers')
  .get(...adminAuth, exportAdminCustomersController);

router
  .route('/admin/settings/export/time-logs')
  .get(...adminAuth, exportAdminTimeLogsController);

export default router;
