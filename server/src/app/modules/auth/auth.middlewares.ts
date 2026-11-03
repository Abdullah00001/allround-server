import { NextFunction, Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler, createRedisKey } from '@/app/utils/system.utils';
import { AuthErrorType, REDIS_PREFIXES } from '@/const';
import prisma from '@/app/configs/db.configs';
import { TSignupPayload } from '@/app/modules/auth/auth.types';
import { compareOtp } from '@/app/utils/otp.utils';
import { getRedisClient } from '@/app/configs/redis.configs';
import { User } from '@prisma/client';

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




/**
 * This middleware is used to check if the OTP is valid and not expired.
 * If the OTP is invalid or expired, it will return a 401 response.
 * If the OTP is valid and not expired, it will call return next() for further process.
 * @param req Request
 * @param res Response
 * @param next NextFunction
 */

export const checkOtpMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const { otp } = req.body;
    // get the redis client
    const redisClient = getRedisClient();
    const hashedOtp = await redisClient.get(
      createRedisKey(REDIS_PREFIXES.otp, user.id)
    );
    if (!hashedOtp) {
      res.status(401).json({
        success: false,
        message: 'OTP has expired, please request a new one',
        errorType: AuthErrorType.OTP_EXPIRED,
        traceId,
      });
      return;
    }
    const isMatched = compareOtp({ hashedOtp, otp });
    if (!isMatched) {
      res.status(401).json({
        success: false,
        message: 'Invalid OTP, please check and try again',
        errorType: AuthErrorType.INVALID_OTP,
        traceId,
      });
      return;
    }
    next();
  }
);
