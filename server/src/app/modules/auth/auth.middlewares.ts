import { NextFunction, Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { AuthErrorType } from '@/const';
import prisma from '@/app/configs/db.configs';
import { TSignupPayload } from '@/app/modules/auth/auth.types';


/**
 * This middleware is for check that is the requested signup user email already exist or not.
 * If exist then its will give duplicate error
 * If no user found then its will pass the request for further process
 * @param req {Request} The request object
 * @param res {Response} The response object
 * @param next {NextFunction} The next function
 * @returns Promise<void>
 */

export const checkIsSignupUserExist = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const traceId = getTraceId();
    const { email } = req.body as TSignupPayload;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exist',
        errorType: AuthErrorType.DUPLICATE_DATA,
        traceId,
      });
    }
    return next();
  }
);