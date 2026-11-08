import { NextFunction, Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler, createRedisKey } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { verifyAccessToken, verifyRefreshToken } from '@/app/utils/jwt.utils';
import { getRedisClient } from '@/app/configs/redis.configs';
import { AuthErrorType, COOKIE_NAMES, REDIS_PREFIXES } from '@/const';
import { Role, User, UserStatus } from '@prisma/client';
import { ITokenPayload } from '@/app/@types/jwt.types';
import { TAdminLoginPayload } from '@/app/modules/admin/admin.types';
import { comparePassword } from '@/app/utils/password.utils';

/**
 * Validates the Double Submit Cookie CSRF token.
 * If no auth cookies are present, passes through so auth middleware can return 401.
 */
export const checkCsrfTokenMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();

    if (
      !req.cookies[COOKIE_NAMES.ACCESS_TOKEN] &&
      !req.cookies[COOKIE_NAMES.REFRESH_TOKEN]
    ) {
      return next();
    }

    const csrfCookie = req.cookies[COOKIE_NAMES.ADMIN_CSRF_TOKEN];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token',
        errorType: AuthErrorType.FORBIDDEN,
        traceId,
      });
      return;
    }

    return next();
  }
);

/**
 * Validates the admin access token from the cookie.
 */
export const checkAdminAccessTokenMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const token = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token not found in cookies',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }

    const redisClient = getRedisClient();
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
      res.status(401).json({
        success: false,
        message:
          decoded.error === AuthErrorType.TOKEN_EXPIRED
            ? 'Token has been expired'
            : 'Token is invalid',
        errorType: decoded.error,
        traceId,
      });
      return;
    }

    req.jwtPayload = decoded.data as ITokenPayload;
    return next();
  }
);

/**
 * Validates the admin refresh token from the cookie.
 */
export const checkAdminRefreshTokenMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const token = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Refresh token not found in cookies',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }

    const decoded = verifyRefreshToken(token);
    if (decoded.error) {
      res.status(401).json({
        success: false,
        message:
          decoded.error === AuthErrorType.TOKEN_EXPIRED
            ? 'Refresh token has been expired'
            : 'Refresh token is invalid',
        errorType: decoded.error,
        traceId,
      });
      return;
    }

    req.jwtPayload = decoded.data as ITokenPayload;
    return next();
  }
);

/**
 * Validates that the admin user exists, has ADMIN role, and is active.
 */
export const checkAdminExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const jwtPayload = req.jwtPayload as ITokenPayload;
    const userId = jwtPayload.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Admin user not found',
        errorType: AuthErrorType.USER_NOT_FOUND,
        traceId,
      });
      return;
    }

    if (user.role !== Role.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied: Requires admin privileges',
        errorType: AuthErrorType.ACCESS_DENIED,
        traceId,
      });
      return;
    }

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

    req.user = user;
    return next();
  }
);

/**
 * Finds an admin user by email for login.
 */
export const findAdminForLoginByEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { email } = req.body as TAdminLoginPayload;
    const isUserExist = await prisma.user.findFirst({
      where: { email, role: Role.ADMIN },
    });
    if (!isUserExist) {
      res.status(401).json({
        success: false,
        errorType: AuthErrorType.INVALID_CREDENTIALS,
        message: 'Invalid Credential,Check Your Email And Password',
        traceId,
      });
      return;
    }
    req.user = isUserExist as User;
    return next();
  }
);

/**
 * Validates the admin's password during login.
 */
export const checkAdminPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const { password } = req.body as TAdminLoginPayload;
    const hashedPassword = (req.user as User).passwordHash;
    const isMatched = await comparePassword(password, hashedPassword);
    if (!isMatched) {
      res.status(401).json({
        success: false,
        errorType: AuthErrorType.INVALID_CREDENTIALS,
        message: 'Invalid Credential,Check Your Email And Password',
        traceId,
      });
      return;
    }
    return next();
  }
);

/**
 * Validates the admin's account status during login.
 */
export const checkAdminAccountStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    return next();
  }
);
