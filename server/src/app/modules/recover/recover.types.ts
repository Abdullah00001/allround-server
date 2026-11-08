import { z } from 'zod';
import {
  findRecoverUserByEmailSchema,
  resetRecoverUserPasswordSchema,
} from '@/app/modules/recover/recover.schema';
import { User } from '@prisma/client';

export type TFindRecoverUserByEmailPayload = z.infer<
  typeof findRecoverUserByEmailSchema
>;

export type TFindRecoverUserByEmailServiceParams = {
  user: User;
  traceId: string;
};

export type TResendRecoverUserOtpServiceParams = {
  user: User;
  traceId: string;
};

export type TVerifyRecoverUserOtpServiceParams = {
  user: User;
};

export type TResetRecoverUserPasswordServiceParams = {
  user: User;
  password: string;
  traceId: string;
  token: string;
};

export type TResetRecoverUserPasswordPayload = z.infer<
  typeof resetRecoverUserPasswordSchema
>;
