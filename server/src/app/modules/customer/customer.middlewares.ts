import { NextFunction, Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import { Customer } from '@prisma/client';

/**
 * Verifies that a non-soft-deleted customer exists for `req.params.id`.
 * On success attaches the Prisma `Customer` to `req.customer` and continues.
 * On failure responds with 404 and `AuthErrorType.CUSTOMER_NOT_FOUND`.
 *
 * @param {Request} req - Express request; expects validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues the middleware chain when the customer exists.
 * @returns {Promise<void>}
 */
export const checkCustomerExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const customerId = req.params.id as string;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
        errorType: AuthErrorType.CUSTOMER_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.customer = customer as Customer;
    next();
  }
);
