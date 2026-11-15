import { Router } from 'express';
import { validateReqQuery } from '@/app/utils/system.utils';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import { getAdminDashboardController } from '@/app/modules/dashboard/dashboard.controllers';
import { getAdminDashboardQuerySchema } from '@/app/modules/dashboard/dashboard.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for dashboard routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/dashboard')
  .get(
    ...adminAuth,
    validateReqQuery(getAdminDashboardQuerySchema),
    getAdminDashboardController
  );

export default router;
