import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  signupService,
  resendOtpService,
} from '@/app/modules/auth/auth.services';
import { TSignupPayload } from './auth.types';
import { User } from '@prisma/client';

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
    await resendOtpService();

    res.status(200).json({
      success: true,
      message: 'Signup verification otp resend successful!',
      traceId,
    });
    return;
  }
);
