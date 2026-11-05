import { NextFunction, Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler, createRedisKey } from '@/app/utils/system.utils';
import { AuthErrorType, REDIS_PREFIXES } from '@/const';
import prisma from '@/app/configs/db.configs';
import { TSignupPayload } from '@/app/modules/auth/auth.types';
import { compareOtp } from '@/app/utils/otp.utils';
import { getRedisClient } from '@/app/configs/redis.configs';
import { DeviceStatus, User, UserStatus } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';
import { extractToken, verifyAccessToken, verifyOtpPageToken } from '@/app/utils/jwt.utils';
import { ITokenPayload } from '@/app/@types/jwt.types';

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
 * This middleware is used to check if the user exists.
 * If the user does not exist, it will return a 404 response.
 * If the user exists, it will call return next() for further process.
 * @param req Request
 * @param res Response
 * @param next NextFunction
 */
export const checkUserExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as JwtPayload;
    const userId = user.sub;
    const isUserExist = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });
    if (!isUserExist) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        errorType: AuthErrorType.USER_NOT_FOUND,
        traceId,
      });
      return;
    }
    req.jwtPayload = user;
    req.user = isUserExist as User;
    next();
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


/**
 * This middleware is used to check if the OTP page token is valid and not expired.
 * If the token is invalid or expired, it will return a 401 response.
 * If the token is valid and not expired, it will call return next() for further process.
 * @param req Request
 * @param res Response
 * @param next NextFunction
 */
export const checkOtpPageTokenMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const traceId = getTraceId();
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token not found',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }
    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
        traceId,
      });
      return;
    }
    const decoded = verifyOtpPageToken(token);
    if (decoded.error) {
      if (decoded.error === AuthErrorType.TOKEN_EXPIRED) {
        res.status(401).json({
          success: false,
          message: 'Token has been expired',
          errorType: AuthErrorType.TOKEN_EXPIRED,
          traceId,
        });
        return;
      }
      res.status(401).json({
        success: false,
        message: 'Token is invalid',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }
    req.user = decoded.data as JwtPayload;
    return next();
  }
);

export const checkUserAccessTokenMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const token = extractToken(req);
    const redisClient = getRedisClient();
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token not found',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }
    const isBlackListed = await redisClient.get(
      createRedisKey(REDIS_PREFIXES.blacklist, token)
    );
    if (isBlackListed) {
      res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        errorType: AuthErrorType.TOKEN_BLACKLISTED,
        traceId,
      });
      return;
    }
    const decoded = verifyAccessToken(token);
    if (decoded.error) {
      if (decoded.error === AuthErrorType.TOKEN_EXPIRED) {
        res.status(401).json({
          success: false,
          message: 'Token has been expired',
          errorType: AuthErrorType.TOKEN_EXPIRED,
          traceId,
        });
        return;
      }
      res.status(401).json({
        success: false,
        message: 'Token is invalid',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }
    req.user = decoded.data as JwtPayload;
    return next();
  }
);

/**
 * Checks if the authenticated user's account is active.
 * Rejects the request if the user is SUSPENDED or INACTIVE.
 *
 * Assumes req.user is already populated by the auth (JWT) middleware upstream.
 * Only validates the USER-level status — device session validity is handled
 * by a separate middleware (checkDeviceSession).
 *
 * @param req Request
 * @param res Response
 * @param next NextFunction
 */
export const checkAccountStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    const traceId = getTraceId();

    if (user.status === UserStatus.SUSPENDED) {
      res.status(403).json({
        success: false,
        errorType: AuthErrorType.USER_SUSPENDED,
        message: 'Your account has been suspended. Please contact the academy.',
        traceId,
      });
      return;
    }

    if (user.status === UserStatus.INACTIVE) {
      res.status(403).json({
        success: false,
        errorType: AuthErrorType.ACCOUNT_INACTIVE,
        message:
          'Your account is not active. Please verify your email or contact support.',
        traceId,
      });
      return;
    }

    next();
  }
);

/**
 * This middleware is used to validate the device context bound to the JWT.
 * It checks device existence, ownership, session status, and expiry.
 * If the device is found in INACTIVE state, it revives it to ACTIVE and refreshes lastSeenAt.
 * If the context is invalid or the session has ended, it returns a 401 response.
 * If valid, it attaches the trusted Device to req.device and calls next().
 * @param req Request
 * @param res Response
 * @param next NextFunction
 */
export const checkDeviceSessionMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const jwtPayload = req.jwtPayload as ITokenPayload;
    const { sub, deviceId } = jwtPayload;

    if (!deviceId) {
      res.status(401).json({
        success: false,
        message: 'Session is missing device information.',
        errorType: AuthErrorType.INVALID_DEVICE_CONTEXT,
        traceId,
      });
      return;
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      res.status(401).json({
        success: false,
        message: 'Session is no longer valid. Please log in again.',
        errorType: AuthErrorType.DEVICE_NOT_FOUND,
        traceId,
      });
      return;
    }

    if (device.userId !== sub) {
      res.status(401).json({
        success: false,
        message: 'Session is no longer valid. Please log in again.',
        errorType: AuthErrorType.DEVICE_NOT_OWNED,
        traceId,
      });
      return;
    }

    if (device.status === DeviceStatus.LOGGED_OUT) {
      res.status(401).json({
        success: false,
        message: 'You have been logged out. Please log in again.',
        errorType: AuthErrorType.SESSION_LOGGED_OUT,
        traceId,
      });
      return;
    }

    if (device.status === DeviceStatus.REVOKED) {
      res.status(401).json({
        success: false,
        message: 'Your session has ended. Please log in again.',
        errorType: AuthErrorType.SESSION_REVOKED,
        traceId,
      });
      return;
    }

    if (device.sessionExpiresAt.getTime() < Date.now()) {
      res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
        errorType: AuthErrorType.SESSION_EXPIRED,
        traceId,
      });
      return;
    }

    if (device.status === DeviceStatus.INACTIVE) {
      const now = new Date();
      await prisma.device.updateMany({
        where: { id: device.id, status: DeviceStatus.INACTIVE },
        data: { status: DeviceStatus.ACTIVE, lastSeenAt: now },
      });
      req.device = { ...device, status: DeviceStatus.ACTIVE, lastSeenAt: now };
      return next();
    }

    req.device = device;
    next();
  }
);
