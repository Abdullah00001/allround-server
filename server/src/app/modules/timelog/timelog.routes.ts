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
import { checkPhaseExistenceMiddleware } from '@/app/modules/project/project.middlewares';
import {
  checkReasonForTimeEditMiddleware,
  checkTimeLogExistenceMiddleware,
  checkTimeLogPendingMiddleware,
  checkTimeLogUserExistenceMiddleware,
} from '@/app/modules/timelog/timelog.middlewares';
import {
  approveTimeLogController,
  createTimeLogController,
  deleteTimeLogController,
  listTimeLogsController,
  rejectTimeLogController,
  updateTimeLogController,
} from '@/app/modules/timelog/timelog.controllers';
import {
  createTimeLogSchema,
  getTimeLogsQuerySchema,
  timeLogIdParamsSchema,
  updateTimeLogSchema,
} from '@/app/modules/timelog/timelog.schema';

const router = Router();

/**
 * Shared admin cookie/CSRF auth chain for all time-log routes.
 */
const adminAuth = [
  checkCsrfTokenMiddleware,
  checkAdminAccessTokenMiddleware,
  checkAdminExistenceMiddleware,
] as const;

router
  .route('/admin/time-logs')
  .get(
    ...adminAuth,
    validateReqQuery(getTimeLogsQuerySchema),
    listTimeLogsController
  )
  .post(
    ...adminAuth,
    validateReqBody(createTimeLogSchema),
    checkTimeLogUserExistenceMiddleware,
    checkPhaseExistenceMiddleware,
    createTimeLogController
  );

router
  .route('/admin/time-logs/:id/approve')
  .patch(
    ...adminAuth,
    validateReqParams(timeLogIdParamsSchema),
    checkTimeLogExistenceMiddleware,
    checkTimeLogPendingMiddleware,
    approveTimeLogController
  );

router
  .route('/admin/time-logs/:id/reject')
  .patch(
    ...adminAuth,
    validateReqParams(timeLogIdParamsSchema),
    checkTimeLogExistenceMiddleware,
    checkTimeLogPendingMiddleware,
    rejectTimeLogController
  );

router
  .route('/admin/time-logs/:id')
  .patch(
    ...adminAuth,
    validateReqParams(timeLogIdParamsSchema),
    checkTimeLogExistenceMiddleware,
    validateReqBody(updateTimeLogSchema),
    checkReasonForTimeEditMiddleware,
    updateTimeLogController
  )
  .delete(
    ...adminAuth,
    validateReqParams(timeLogIdParamsSchema),
    checkTimeLogExistenceMiddleware,
    deleteTimeLogController
  );

export default router;
