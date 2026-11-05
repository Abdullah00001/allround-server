import { z } from 'zod';
import { signupSchema } from '@/app/modules/auth/auth.schema';
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
