import { Router } from 'express';
import {
  findRecoverUserController,
  resendRecoverUserOtpController,
  verifyRecoverUserOtpController,
  resetRecoverUserPasswordController,
  findAdminEmailForRecoverAccountController,
  resendOtpToRecoverAdminEmailController,
  verifyRecoverAdminOtpController,
  resetRecoverAdminPasswordController,
} from '@/app/modules/recover/recover.controllers';
import { validateReqBody } from '@/app/utils/system.utils';
import {
  findRecoverUserByEmailSchema,
  resetRecoverUserPasswordSchema,
  verifyRecoverUserOtpSchema,
} from '@/app/modules/recover/recover.schema';
import {
  findRecoverUserMiddleware,
  checkResetPasswordPageTokenMiddleware,
  checkCurrentPasswordForReset,
} from '@/app/modules/recover/recover.middlewares';
import {
  checkAccountStatus,
  checkOtpMiddleware,
  checkUserExistenceMiddleware,
  requireRole,
} from '@/app/modules/auth/auth.middlewares';
import { Role } from '@prisma/client';

const router = Router();

router
  .route('/recover/find')
  .post(
    validateReqBody(findRecoverUserByEmailSchema),
    findRecoverUserMiddleware,
    checkAccountStatus,
    findRecoverUserController
  );

router
  .route('/recover/resend')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    resendRecoverUserOtpController
  );

router
  .route('/recover/verify')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    validateReqBody(verifyRecoverUserOtpSchema),
    checkOtpMiddleware,
    verifyRecoverUserOtpController
  );

router
  .route('/recover/reset')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    validateReqBody(resetRecoverUserPasswordSchema),
    checkCurrentPasswordForReset,
    resetRecoverUserPasswordController
  );

router
  .route('/admin/recover/find')
  .post(
    validateReqBody(findRecoverUserByEmailSchema),
    findRecoverUserMiddleware,
    checkAccountStatus,
    requireRole(Role.ADMIN),
    findAdminEmailForRecoverAccountController
  );

router
  .route('/admin/recover/resend')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    requireRole(Role.ADMIN),
    resendOtpToRecoverAdminEmailController
  );

router
  .route('/admin/recover/verify')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    requireRole(Role.ADMIN),
    validateReqBody(verifyRecoverUserOtpSchema),
    checkOtpMiddleware,
    verifyRecoverAdminOtpController
  );

router
  .route('/admin/recover/reset')
  .post(
    checkResetPasswordPageTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    requireRole(Role.ADMIN),
    validateReqBody(resetRecoverUserPasswordSchema),
    checkCurrentPasswordForReset,
    resetRecoverAdminPasswordController
  );

export default router;
