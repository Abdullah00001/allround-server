import { Router } from 'express';
import {
  signupController,
  resendSignupOtpController,
  verifySignupUserControllerController,
  checkUserAccessTokenController,
  loginController,
} from '@/app/modules/auth/auth.controllers';
import {
  checkIsSignupUserExist,
  checkUserExistenceMiddleware,
  checkOtpPageTokenMiddleware,
  checkOtpMiddleware,
  checkUserAccessTokenMiddleware,
  checkAccountStatus,
  checkDeviceSessionMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import { validateReqBody } from '@/app/utils/system.utils';
import {
  checkAccessTokenSchema,
  signupSchema,
  verifySignupSchema,
} from '@/app/modules/auth/auth.schema';

const router = Router();

/**
 * Signup a new user
 * @route POST /auth/signup
 * @access Public
 */
router
  .route('/auth/signup')
  .post(
    validateReqBody(signupSchema),
    checkIsSignupUserExist,
    signupController
  );

router
  .route('/auth/resend')
  .post(
    checkOtpPageTokenMiddleware,
    checkUserExistenceMiddleware,
    resendSignupOtpController
  );

router
  .route('/auth/verify')
  .post(
    checkOtpPageTokenMiddleware,
    checkUserExistenceMiddleware,
    validateReqBody(verifySignupSchema),
    checkOtpMiddleware,
    verifySignupUserControllerController
  );

router
  .route('/auth/check')
  .post(
    validateReqBody(checkAccessTokenSchema),
    checkUserAccessTokenMiddleware,
    checkUserExistenceMiddleware,
    checkAccountStatus,
    checkDeviceSessionMiddleware,
    checkUserAccessTokenController
  );

router.route('/auth/login').post(loginController);

export default router;
