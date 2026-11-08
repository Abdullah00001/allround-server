import { z } from 'zod';
import { User } from '@prisma/client';
import { adminLoginSchema } from '@/app/modules/admin/admin.schema';

export type TAdminLoginPayload = z.infer<typeof adminLoginSchema>;

export interface ILoginAdminServiceParams {
  user: User;
  rememberMe: boolean;
}

export interface ICheckAdminServiceParams {
  user: User;
}

export interface IRefreshAdminServiceParams {
  user: User;
  refreshToken: string;
  rememberMe: boolean;
}

export interface ILogoutAdminServiceParams {
  user: User;
  accessToken?: string;
  refreshToken?: string;
}
