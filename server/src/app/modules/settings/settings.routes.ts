import { Router } from 'express';
import { validateReqBody } from '@/app/utils/system.utils';
import {
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import { changePasswordController } from '@/app/modules/settings/settings.controllers';
import { checkCurrentPasswordMiddleware } from '@/app/modules/settings/settings.middlewares';
import { changePasswordSchema } from '@/app/modules/settings/settings.schema';

const router = Router();

/**
 * Mobile bearer auth (EMPLOYEE + SITE_MANAGER use the same chain).
 */
const mobileAuth = [
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
  checkAccountStatus,
  checkDeviceSessionMiddleware,
] as const;

/**
 * Change password for mobile roles (alua-compatible path).
 * Revokes all other active devices; keeps the current device session.
 */
router
  .route('/settings/password')
  .post(
    ...mobileAuth,
    validateReqBody(changePasswordSchema),
    checkCurrentPasswordMiddleware,
    changePasswordController
  );

export default router;
