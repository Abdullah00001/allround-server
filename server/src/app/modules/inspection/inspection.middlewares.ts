import { NextFunction, Request, Response } from 'express';
import { Inspection, InspectionStatus } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';
import {
  TCreateInspectionPayload,
  TUpdateInspectionPayload,
} from '@/app/modules/inspection/inspection.types';

/**
 * Verifies that a non-soft-deleted inspection exists for `req.params.id`.
 * Attaches the Prisma `Inspection` to `req.inspection` on success.
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the inspection exists.
 * @returns {Promise<void>}
 */
export const checkInspectionExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const inspectionId = req.params.id as string;

    const inspection = await prisma.inspection.findFirst({
      where: { id: inspectionId, deletedAt: null },
    });

    if (!inspection) {
      res.status(404).json({
        success: false,
        message: 'Inspection not found',
        errorType: AuthErrorType.INSPECTION_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.inspection = inspection as Inspection;
    next();
  }
);

/**
 * Ensures `req.body.customerId` references a non-deleted customer.
 * Used on inspection create.
 *
 * @param {Request} req - Express request with validated create body.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the customer exists.
 * @returns {Promise<void>}
 */
export const checkInspectionCustomerExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { customerId } = req.body as TCreateInspectionPayload;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
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

    next();
  }
);

/**
 * Ensures optional `siteManagerId` on create/update references an existing user.
 * Skips the check when the field is absent or explicitly null.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the site manager is valid or omitted.
 * @returns {Promise<void>}
 */
export const checkOptionalSiteManagerExistsMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const body = req.body as
      | TCreateInspectionPayload
      | TUpdateInspectionPayload;
    const siteManagerId = body.siteManagerId;

    if (siteManagerId === undefined || siteManagerId === null) {
      next();
      return;
    }

    const siteManager = await prisma.user.findUnique({
      where: { id: siteManagerId },
      select: { id: true },
    });

    if (!siteManager) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        errorType: AuthErrorType.USER_NOT_FOUND,
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * Blocks conversion when the inspection is already `CONVERTED`.
 * Must run after `checkInspectionExistenceMiddleware`.
 *
 * @param {Request} req - Express request with trusted `req.inspection`.
 * @param {Response} res - Express response used for the 409 envelope.
 * @param {NextFunction} next - Continues when conversion is allowed.
 * @returns {Promise<void>}
 */
export const checkInspectionConvertibleMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const inspection = req.inspection as Inspection;

    if (inspection.status === InspectionStatus.CONVERTED) {
      res.status(409).json({
        success: false,
        message: 'Inspection is already converted to a project',
        errorType: AuthErrorType.INSPECTION_ALREADY_CONVERTED,
        traceId,
      });
      return;
    }

    next();
  }
);
