import { z } from 'zod';
import { User } from '@prisma/client';
import {
  adminLoginSchema,
  changeAdminPasswordSchema,
  updateAdminCompanySettingsSchema,
  updateAdminLanguagesSchema,
  updateAdminProfileSchema,
} from '@/app/modules/admin/admin.schema';

export type TAdminLoginPayload = z.infer<typeof adminLoginSchema>;

/**
 * Validated admin self-profile patch body.
 */
export type TUpdateAdminProfilePayload = z.infer<
  typeof updateAdminProfileSchema
>;

/**
 * Validated admin change-password body.
 */
export type TChangeAdminPasswordPayload = z.infer<
  typeof changeAdminPasswordSchema
>;

/**
 * Validated admin company settings patch body.
 */
export type TUpdateAdminCompanySettingsPayload = z.infer<
  typeof updateAdminCompanySettingsSchema
>;

/**
 * Validated admin company languages patch body.
 */
export type TUpdateAdminLanguagesPayload = z.infer<
  typeof updateAdminLanguagesSchema
>;

/**
 * Service params for admin self password change.
 */
export type TChangeAdminPasswordServiceParams = {
  /** Authenticated admin user id. */
  userId: string;
  /** Already-validated new password (plain). */
  newPassword: string;
};

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

/**
 * Service params for fetching the authenticated admin profile.
 */
export type TGetAdminProfileServiceParams = {
  /** Trusted admin from existence middleware. */
  user: User;
};

/**
 * Service params for patching the authenticated admin profile.
 */
export type TUpdateAdminProfileServiceParams = {
  /** Trusted admin from existence middleware. */
  user: User;
  /** Validated patch payload (≥1 field). */
  payload: TUpdateAdminProfilePayload;
};
