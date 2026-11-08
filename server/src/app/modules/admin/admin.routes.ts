import { Router } from 'express';
import { validateReqBody } from '@/app/utils/system.utils';
import { adminLoginSchema } from '@/app/modules/admin/admin.schema';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminAccountStatus,
  checkAdminExistenceMiddleware,
  checkAdminPassword,
  checkAdminRefreshTokenMiddleware,
  checkCsrfTokenMiddleware,
  findAdminForLoginByEmail,
} from '@/app/modules/admin/admin.middlewares';
import {
  checkAdminController,
  loginAdminController,
  logoutAdminController,
  refreshAdminController,
} from '@/app/modules/admin/admin.controllers';

const router = Router();

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

export default router;
