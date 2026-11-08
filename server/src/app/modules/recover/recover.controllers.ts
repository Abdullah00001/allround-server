import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  findRecoverUserService,
  resendRecoverUserOtpService,
  verifyRecoverUserOtpService,
  resetRecoverUserPasswordService,
  findAdminEmailForRecoverAccountService,
  resendOtpToRecoverAdminEmailService,
  verifyRecoverAdminOtpService,
  resetRecoverAdminPasswordService,
} from '@/app/modules/recover/recover.services';
import { User } from '@prisma/client';
import { TResetRecoverUserPasswordPayload } from '@/app/modules/recover/recover.types';
import { extractToken } from '@/app/utils/jwt.utils';
import { COOKIE_NAMES, resetOtpPageTokenExpiresIn } from '@/const';
import { cookieOption } from '@/app/utils/cookie.utils';

export const findRecoverUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await findRecoverUserService({ traceId, user });

    res.status(200).json({
      success: true,
      message: 'Recover user found and otp send to user email.',
      data,
      traceId,
    });
    return;
  }
);

export const resendRecoverUserOtpController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    await resendRecoverUserOtpService({ traceId, user });
    res.status(200).json({
      success: true,
      message: 'Recover user otp resend successful!',
      traceId,
    });
    return;
  }
);

export const verifyRecoverUserOtpController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    await verifyRecoverUserOtpService({ user });
    res.status(200).json({
      success: true,
      message: 'Recover user otp verification successful!',
      traceId,
    });
    return;
  }
);

export const resetRecoverUserPasswordController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const { password } = req.body as TResetRecoverUserPasswordPayload;
    const user = req.user as User;
    const token = extractToken(req) as string;
    await resetRecoverUserPasswordService({ password, traceId, user, token });
    res.status(200).json({
      success: true,
      message: 'Recover user password reset successful!',
      traceId,
    });
    return;
  }
);

export const findAdminEmailForRecoverAccountController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const data = await findAdminEmailForRecoverAccountService({
      traceId,
      user,
    });

    res.cookie(
      COOKIE_NAMES.RECOVER_PAGE_TOKEN,
      data.token,
      cookieOption(resetOtpPageTokenExpiresIn)
    );
    res.status(200).json({
      success: true,
      message: 'Recover user found and otp send successfully',
      traceId,
    });
    return;
  }
);

export const resendOtpToRecoverAdminEmailController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    await resendOtpToRecoverAdminEmailService({ traceId, user });

    res.status(200).json({
      success: true,
      message: 'Otp resend successful to admin email!',
      traceId,
    });
    return;
  }
);

export const verifyRecoverAdminOtpController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    await verifyRecoverAdminOtpService({ user });

    res.status(200).json({
      success: true,
      message: 'Otp verification successful for recover admin account!',
      traceId,
    });
    return;
  }
);

export const resetRecoverAdminPasswordController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const { password } = req.body as TResetRecoverUserPasswordPayload;
    const user = req.user as User;
    const token =
      (req.cookies[COOKIE_NAMES.RECOVER_PAGE_TOKEN] as string) ||
      (extractToken(req) as string);
    await resetRecoverAdminPasswordService({
      password,
      traceId,
      user,
      token,
    });
    res.clearCookie(COOKIE_NAMES.RECOVER_PAGE_TOKEN);
    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      traceId,
    });
    return;
  }
);
