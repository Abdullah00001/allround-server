import { Request, Response } from 'express';
import { Device, User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  changePasswordService,
  updateLanguageService,
} from '@/app/modules/settings/settings.services';
import {
  TChangePasswordPayload,
  TUpdateLanguagePayload,
} from '@/app/modules/settings/settings.types';

/**
 * Handles `POST /settings/password` for EMPLOYEE and SITE_MANAGER.
 *
 * @param {Request} req - Express request with trusted user, device, and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const changePasswordController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const device = req.device as Device;
    const payload = req.body as TChangePasswordPayload;

    await changePasswordService({
      user,
      deviceId: device.id,
      payload,
    });

    res.status(200).json({
      success: true,
      message: 'Change password successful.',
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /settings/language` for EMPLOYEE and SITE_MANAGER.
 * Persists `UserPreference.language` (Flutter language picker / alua path).
 *
 * @param {Request} req - Express request with trusted user and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateLanguageController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const payload = req.body as TUpdateLanguagePayload;
    const data = await updateLanguageService({ user, payload });

    res.status(200).json({
      success: true,
      message: 'Language updated successfully.',
      data,
      traceId,
    });
    return;
  }
);
