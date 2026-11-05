import { Router } from 'express';
import { signupController, resendSignupOtpController,  verifySignupUserControllerController } from '@/app/modules/auth/auth.controllers';
import {
  checkIsSignupUserExist,
  checkUserExistenceMiddleware,
  checkOtpPageTokenMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import { validateReqBody } from '@/app/utils/system.utils';
import { signupSchema } from '@/app/modules/auth/auth.schema';

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

router.route('/auth/verify').post(verifySignupUserControllerController);

export default router;
