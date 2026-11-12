import { Router } from 'express';
import {
  validateReqBody,
  validateReqParams,
  validateReqQuery,
} from '@/app/utils/system.utils';
import {
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
  checkCsrfTokenMiddleware,
} from '@/app/modules/admin/admin.middlewares';
import {
  checkEmailNotExistsMiddleware,
  checkUpdateEmailNotExistsMiddleware,
  checkUserExistenceMiddleware,
} from '@/app/modules/user/user.middlewares';
import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController,
} from '@/app/modules/user/user.controllers';
import {
  createUserSchema,
  getUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from '@/app/modules/user/user.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all admin user-management routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/users')
  .post(
    ...adminAuth,
    validateReqBody(createUserSchema),
    checkEmailNotExistsMiddleware,
    createUserController
  )
  .get(
    ...adminAuth,
    validateReqQuery(getUsersQuerySchema),
    listUsersController
  );

router
  .route('/admin/users/:id')
  .get(
    ...adminAuth,
    validateReqParams(userIdParamsSchema),
    checkUserExistenceMiddleware,
    getUserByIdController
  )
  .patch(
    ...adminAuth,
    validateReqParams(userIdParamsSchema),
    checkUserExistenceMiddleware,
    validateReqBody(updateUserSchema),
    checkUpdateEmailNotExistsMiddleware,
    updateUserController
  )
  .delete(
    ...adminAuth,
    validateReqParams(userIdParamsSchema),
    checkUserExistenceMiddleware,
    deleteUserController
  );

export default router;
