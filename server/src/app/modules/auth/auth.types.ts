import { z } from 'zod';
import {
  signupSchema,
  verifySignupSchema,
} from '@/app/modules/auth/auth.schema';
import { User } from '@prisma/client';

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
