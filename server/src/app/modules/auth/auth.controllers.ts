import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { signupService } from '@/app/modules/auth/auth.services';

export const signupController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    await signupService();
    
    res.status(201).json({
      success: true,
      message: 'Signup successful, Please check your email for verification code to verify your account',
      traceId
    });
    return;
  }
);
