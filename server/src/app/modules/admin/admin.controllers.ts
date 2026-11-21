import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  changeAdminPasswordService,
  checkAdminService,
  exportAdminCustomersCsvService,
  exportAdminProjectsCsvService,
  exportAdminTimeLogsCsvService,
  getAdminCompanySettingsService,
  getAdminLanguagesService,
  getAdminProfileService,
  loginAdminService,
  logoutAdminService,
  refreshAdminService,
  updateAdminCompanySettingsService,
  updateAdminLanguagesService,
  updateAdminProfileService,
} from '@/app/modules/admin/admin.services';
import {
  TAdminLoginPayload,
  TChangeAdminPasswordPayload,
  TUpdateAdminCompanySettingsPayload,
  TUpdateAdminLanguagesPayload,
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

/**
 * Handles `GET /admin/settings/company`.
 * Returns branding + access-policy settings for System & company settings.
 *
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAdminCompanySettingsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const data = await getAdminCompanySettingsService();

    res.status(200).json({
      success: true,
      message: 'Company settings fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/settings/company`.
 * Updates branding and/or access-policy fields on CompanyProfile.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateAdminCompanySettingsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TUpdateAdminCompanySettingsPayload;
    const data = await updateAdminCompanySettingsService(payload);

    res.status(200).json({
      success: true,
      message: 'Company settings updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/settings/languages`.
 * Returns all 18 catalog languages with company enabled/default toggles.
 *
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAdminLanguagesController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const data = await getAdminLanguagesService();

    res.status(200).json({
      success: true,
      message: 'Languages fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/settings/languages`.
 * Updates company defaultLanguage and/or enabledLanguages.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateAdminLanguagesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TUpdateAdminLanguagesPayload;
    const data = await updateAdminLanguagesService(payload);

    res.status(200).json({
      success: true,
      message: 'Languages updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Sends a CSV file download response for Settings → Data export.
 *
 * @param {Response} res - Express response.
 * @param {{ filename: string; csv: string }} file - Export payload.
 * @returns {void}
 */
const sendAdminCsvDownload = (
  res: Response,
  file: { filename: string; csv: string }
): void => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename}"`
  );
  res.status(200).send(file.csv);
};

/**
 * Handles `GET /admin/settings/export/projects`.
 *
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response (CSV download).
 * @returns {Promise<void>}
 */
export const exportAdminProjectsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const file = await exportAdminProjectsCsvService();
    sendAdminCsvDownload(res, file);
  }
);

/**
 * Handles `GET /admin/settings/export/customers`.
 *
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response (CSV download).
 * @returns {Promise<void>}
 */
export const exportAdminCustomersController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const file = await exportAdminCustomersCsvService();
    sendAdminCsvDownload(res, file);
  }
);

/**
 * Handles `GET /admin/settings/export/time-logs`.
 *
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response (CSV download).
 * @returns {Promise<void>}
 */
export const exportAdminTimeLogsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const file = await exportAdminTimeLogsCsvService();
    sendAdminCsvDownload(res, file);
  }
);
