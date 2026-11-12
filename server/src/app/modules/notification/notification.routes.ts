import { Router } from 'express';

import {
  validateReqParams,
  validateReqQuery,
} from '@/app/utils/system.utils';
import {
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
} from '@/app/modules/auth/auth.middlewares';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import { syncLocaleFromAuthenticatedUserMiddleware } from '@/app/middlewares/locale.middlewares';
import { checkNotificationOwnershipMiddleware } from '@/app/modules/notification/notification.middlewares';
import {
  getNotificationsController,
  markAllAsReadController,
  markAsReadController,
} from '@/app/modules/notification/notification.controllers';
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from '@/app/modules/notification/notification.schema';

const router = Router();

/**
 * Shared mobile bearer + device session auth chain.
 */
const mobileAuth = [
  checkUserAccessTokenMiddleware,
  checkUserExistenceMiddleware,
  checkAccountStatus,
  checkDeviceSessionMiddleware,
  syncLocaleFromAuthenticatedUserMiddleware,
] as const;

/**
 * Shared admin cookie/CSRF auth chain.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  syncLocaleFromAuthenticatedUserMiddleware,
] as const;

router
  .route('/mobile/notifications')
  .get(
    ...mobileAuth,
    validateReqQuery(getNotificationsQuerySchema),
    getNotificationsController
  );

router
  .route('/mobile/notifications/read-all')
  .patch(...mobileAuth, markAllAsReadController);

router
  .route('/mobile/notifications/:id/read')
  .patch(
    ...mobileAuth,
    validateReqParams(notificationIdParamSchema),
    checkNotificationOwnershipMiddleware,
    markAsReadController
  );

router
  .route('/admin/notifications')
  .get(
    ...adminAuth,
    validateReqQuery(getNotificationsQuerySchema),
    getNotificationsController
  );

router
  .route('/admin/notifications/read-all')
  .patch(...adminAuth, markAllAsReadController);

router
  .route('/admin/notifications/:id/read')
  .patch(
    ...adminAuth,
    validateReqParams(notificationIdParamSchema),
    checkNotificationOwnershipMiddleware,
    markAsReadController
  );

export default router;
