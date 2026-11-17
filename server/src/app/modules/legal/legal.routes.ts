import { Router } from 'express';
import {
  validateReqBody,
  validateReqParams,
} from '@/app/utils/system.utils';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import {
  getAdminLegalContentController,
  getLegalContentController,
  updateLegalContentController,
} from '@/app/modules/legal/legal.controllers';
import {
  legalTypeParamSchema,
  updateLegalContentSchema,
} from '@/app/modules/legal/legal.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for legal CRM routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

/**
 * Public legal documents (login / about screens without bearer auth).
 * UI mapping: Privacy Policy → PRIVACY_AND_POLICY, Terms → TERMS_AND_CONDITION.
 */
router
  .route('/legal/:type')
  .get(validateReqParams(legalTypeParamSchema), getLegalContentController);

/**
 * Admin Settings → Legal tab (load editor + Publish).
 */
router
  .route('/admin/legal/:type')
  .get(
    ...adminAuth,
    validateReqParams(legalTypeParamSchema),
    getAdminLegalContentController
  )
  .patch(
    ...adminAuth,
    validateReqParams(legalTypeParamSchema),
    validateReqBody(updateLegalContentSchema),
    updateLegalContentController
  );

export default router;
