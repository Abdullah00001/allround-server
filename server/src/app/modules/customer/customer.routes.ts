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
import { checkCustomerExistenceMiddleware } from '@/app/modules/customer/customer.middlewares';
import {
  addCustomerContactController,
  createCustomerController,
  getCustomerByIdController,
  listCustomersController,
  updateCustomerController,
} from '@/app/modules/customer/customer.controllers';
import {
  createContactSchema,
  createCustomerSchema,
  customerIdParamsSchema,
  getCustomersQuerySchema,
  updateCustomerSchema,
} from '@/app/modules/customer/customer.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all customer CRM routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/customers')
  .post(
    ...adminAuth,
    validateReqBody(createCustomerSchema),
    createCustomerController
  )
  .get(
    ...adminAuth,
    validateReqQuery(getCustomersQuerySchema),
    listCustomersController
  );

router
  .route('/admin/customers/:id')
  .get(
    ...adminAuth,
    validateReqParams(customerIdParamsSchema),
    checkCustomerExistenceMiddleware,
    getCustomerByIdController
  )
  .patch(
    ...adminAuth,
    validateReqParams(customerIdParamsSchema),
    checkCustomerExistenceMiddleware,
    validateReqBody(updateCustomerSchema),
    updateCustomerController
  );

router
  .route('/admin/customers/:id/contacts')
  .post(
    ...adminAuth,
    validateReqParams(customerIdParamsSchema),
    checkCustomerExistenceMiddleware,
    validateReqBody(createContactSchema),
    addCustomerContactController
  );

export default router;
