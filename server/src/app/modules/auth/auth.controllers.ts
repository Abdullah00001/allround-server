import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  signupService,
  resendOtpService,
  verifySignupUserControllerService,
  checkUserAccessTokenService,
  loginService,
  logoutService,
} from '@/app/modules/auth/auth.services';
import {
  TCheckAccessTokenPayload,
  TLoginPayload,
  TSignupPayload,
  TVerifySignupPayload,
} from '@/app/modules/auth/auth.types';
import { Device, User } from '@prisma/client';
import { extractToken } from '@/app/utils/jwt.utils';
import { ITokenPayload } from '@/app/@types/jwt.types';

export const signupController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TSignupPayload;
    const data = await signupService({ payload, traceId });

    res.status(201).json({
      success: true,
      message:
        'Signup successful, Please check your email for verification code to verify your account',
      data,
      traceId,
    });
    return;
  }
);

export const resendSignupOtpController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    await resendOtpService({ user, traceId });

    res.status(200).json({
      success: true,
      message: 'Signup verification otp resend successful!',
      traceId,
    });
    return;
  }
);

export const verifySignupUserControllerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const token = extractToken(req) as string;
    const payload = req.body as TVerifySignupPayload;
    const user = req.user as User;
    const data = await verifySignupUserControllerService({
      payload,
      traceId,
      token,
      user,
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      data,
      traceId,
    });
    return;
  }
);

export const checkUserAccessTokenController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const device = req.user as Device;
    const payload = req.body as TCheckAccessTokenPayload;
    const data = await checkUserAccessTokenService({
      payload,
      user,
      device,
    });

    res.status(200).json({
      success: true,
      message: 'User is authenticated',
      data,
      traceId,
    });
    return;
  }
);

export const loginController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TLoginPayload;
    const user = req.user as User;
    const data = await loginService({ payload, user });

    res.status(200).json({
      success: true,
      message: 'User login successful.',
      data,
      traceId,
    });
    return;
  }
);

export const logoutController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const device = req.device as Device;
    const jwtPayload = req.jwtPayload as ITokenPayload;
    const token = extractToken(req) as string;

    await logoutService({ device, jwtPayload, token });

    res.status(200).json({
      success: true,
      message: 'Logout successful.',
      traceId,
    });
    return;
  }
);
