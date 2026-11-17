import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  changeAdminPasswordService,
  checkAdminService,
  getAdminProfileService,
  loginAdminService,
  logoutAdminService,
  refreshAdminService,
  updateAdminProfileService,
} from '@/app/modules/admin/admin.services';
import {
  TAdminLoginPayload,
  TChangeAdminPasswordPayload,
  TUpdateAdminProfilePayload,
} from '@/app/modules/admin/admin.types';
import { User } from '@prisma/client';
import { cookieOption } from '@/app/utils/cookie.utils';
import {
  adminAccessTokenExpiresIn,
  AuthErrorType,
  COOKIE_NAMES,
  refreshTokenExpiresInWithOutRememberMe,
  refreshTokenExpiresInWithRememberMe,
} from '@/const';
import { AdminLoginDTO, AdminSessionDTO } from '@/app/modules/admin/admin.dto';
import { ITokenPayload } from '@/app/@types/jwt.types';

/**
 * Admin login: set cookies and return admin session + csrfToken.
 */
export const loginAdminController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const { rememberMe = false } = req.body as TAdminLoginPayload;

    const data = await loginAdminService({ user, rememberMe });

    const refreshDuration = rememberMe
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;

    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      data.accessToken,
      cookieOption(adminAccessTokenExpiresIn)
    );

    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      data.refreshToken,
      cookieOption(refreshDuration)
    );

    res.cookie(COOKIE_NAMES.ADMIN_CSRF_TOKEN, data.csrfToken, {
      ...cookieOption(refreshDuration),
      httpOnly: false,
    });

    res.status(200).json({
      success: true,
      message: 'Admin login successful!',
      data: AdminLoginDTO.build(data.admin),
      csrfToken: data.csrfToken,
      traceId,
    });
    return;
  }
);

/**
 * Admin session check.
 */
export const checkAdminController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;

    const data = await checkAdminService({ user });

    res.status(200).json({
      success: true,
      message: 'Admin authenticated successfully',
      data: AdminSessionDTO.build(data.admin),
      traceId,
    });
    return;
  }
);

/**
 * Refresh admin access/refresh/csrf cookies.
 */
export const refreshAdminController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const jwtPayload = req.jwtPayload as ITokenPayload;
    const oldRefreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN] as string;
    const rememberMe = jwtPayload.rememberMe ?? false;

    const data = await refreshAdminService({
      user,
      refreshToken: oldRefreshToken,
      rememberMe,
    });

    if (!data) {
      res.status(401).json({
        success: false,
        message: 'Refresh token is invalid or already consumed',
        errorType: AuthErrorType.TOKEN_INVALID,
        traceId,
      });
      return;
    }

    const refreshDuration = rememberMe
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;

    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      data.accessToken,
      cookieOption(adminAccessTokenExpiresIn)
    );

    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      data.refreshToken,
      cookieOption(refreshDuration)
    );

    res.cookie(COOKIE_NAMES.ADMIN_CSRF_TOKEN, data.csrfToken, {
      ...cookieOption(refreshDuration),
      httpOnly: false,
    });

    res.status(200).json({
      success: true,
      message: 'Admin tokens refreshed successfully',
      csrfToken: data.csrfToken,
      traceId,
    });
    return;
  }
);

/**
 * Admin logout: clear cookies and invalidate Redis session.
 */
export const logoutAdminController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const accessToken = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];
    const refreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

    await logoutAdminService({
      user,
      accessToken,
      refreshToken,
    });

    res.clearCookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      cookieOption(adminAccessTokenExpiresIn)
    );
    res.clearCookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      cookieOption(refreshTokenExpiresInWithRememberMe)
    );
    res.clearCookie(COOKIE_NAMES.ADMIN_CSRF_TOKEN, {
      ...cookieOption(refreshTokenExpiresInWithRememberMe),
      httpOnly: false,
    });

    res.status(200).json({
      success: true,
      message: 'Admin logged out successfully',
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/profile`.
 * Returns the authenticated admin's self-profile.
 *
 * @param {Request} req - Express request with trusted `req.user`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAdminProfileController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await getAdminProfileService({ user });

    res.status(200).json({
      success: true,
      message: 'Profile fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/profile`.
 * Updates self-profile fields for the authenticated admin.
 *
 * @param {Request} req - Express request with trusted `req.user` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateAdminProfileController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const payload = req.body as TUpdateAdminProfilePayload;
    const data = await updateAdminProfileService({ user, payload });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/settings/password`.
 * Updates password, revokes Redis sessions, and clears auth cookies.
 *
 * @param {Request} req - Express request with trusted admin and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const changeAdminPasswordController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const { newPassword } = req.body as TChangeAdminPasswordPayload;

    await changeAdminPasswordService({
      userId: user.id,
      newPassword,
    });

    res.clearCookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      cookieOption(adminAccessTokenExpiresIn)
    );
    res.clearCookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      cookieOption(refreshTokenExpiresInWithRememberMe)
    );
    res.clearCookie(COOKIE_NAMES.ADMIN_CSRF_TOKEN, {
      ...cookieOption(refreshTokenExpiresInWithRememberMe),
      httpOnly: false,
    });

    res.status(200).json({
      success: true,
      message: 'Admin password changed successfully',
      traceId,
    });
    return;
  }
);
