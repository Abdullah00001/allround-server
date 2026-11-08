import { z } from 'zod';
import {
  checkAccessTokenSchema,
  loginSchema,
  signupSchema,
  verifySignupSchema,
} from '@/app/modules/auth/auth.schema';
import { Device, User } from '@prisma/client';

export type TSignupPayload = z.infer<typeof signupSchema>;

export type TSignupServiceParams = {
  payload: TSignupPayload;
  traceId: string;
};

export type TResendOtpServiceParams = {
  traceId: string;
  user: User;
};

export type TVerifySignupPayload = z.infer<typeof verifySignupSchema>;

export type TVerifySignupServiceParams = {
  payload: TVerifySignupPayload;
  traceId: string;
  token: string;
  user: User;
};

export type TCheckAccessTokenPayload = z.infer<typeof checkAccessTokenSchema>;

export type TCheckAccessTokenServiceParams = {
  payload: TCheckAccessTokenPayload;
  user: User;
  device: Device;
};

export type TLoginPayload = z.infer<typeof loginSchema>;

export type TLoginServiceParams = {
  payload: TLoginPayload;
  user: User;
};
