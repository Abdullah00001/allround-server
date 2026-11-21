import { Language } from '@prisma/client';
import { z } from 'zod';

/**
 * Request body for admin login.
 */
export const adminLoginSchema = z
  .object({
    email: z
      .email({ error: 'Please provide a valid email address' })
      .toLowerCase()
      .trim(),
    password: z.string().min(1, { error: 'Password is required' }),
    rememberMe: z.boolean().default(false),
  })
  .strict();

/**
 * Request body for `PATCH /admin/profile` (self-profile update).
 * At least one field required. Email/role/status/password are not patchable.
 */
export const updateAdminProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    phone: z.string().trim().nullable().optional(),
    avatarUrl: z
      .string()
      .url({ message: 'Invalid avatar URL' })
      .nullable()
      .optional(),
    language: z.enum(Language, { message: 'Invalid language' }).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Request body for `POST /admin/settings/password` (alua-aligned).
 */
export const changeAdminPasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: 'Current password is required' }),
    newPassword: z
      .string()
      .min(8, { error: 'Password must be at least 8 characters long' })
      .max(32, { error: 'Password must not exceed 32 characters' })
      .regex(/[A-Z]/, {
        error: 'Password must contain at least one uppercase letter',
      })
      .regex(/[a-z]/, {
        error: 'Password must contain at least one lowercase letter',
      })
      .regex(/[0-9]/, { error: 'Password must contain at least one number' })
      .regex(/[^A-Za-z0-9]/, {
        error: 'Password must contain at least one special character',
      })
      .trim(),
  })
  .strict();

/**
 * Site-manager project visibility rule stored on CompanyProfile.
 */
export const siteManagerAccessRuleEnum = z.enum(
  ['RESTRICT_TO_ASSIGNED', 'GLOBAL_ACCESS'],
  { message: 'Invalid siteManagerAccessRule' }
);

/**
 * Request body for `PATCH /admin/settings/company`
 * (General branding + Access policies). At least one field required.
 */
export const updateAdminCompanySettingsSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    officialName: z.string().trim().min(1).optional(),
    taxId: z.string().trim().min(1).nullable().optional(),
    headOffice: z.string().trim().min(1).nullable().optional(),
    logoUrl: z
      .string()
      .url({ message: 'Invalid logo URL' })
      .nullable()
      .optional(),
    siteManagerAccessRule: siteManagerAccessRuleEnum.optional(),
    allowEmployeeManualTime: z.boolean().optional(),
    allowSiteManagerCreateProject: z.boolean().optional(),
    requireReasonForTimeEdit: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Request body for `PATCH /admin/settings/languages` (Available languages UI).
 * Default must always be included in `enabledLanguages` when both are sent.
 */
export const updateAdminLanguagesSchema = z
  .object({
    defaultLanguage: z
      .enum(Language, { message: 'Invalid default language' })
      .optional(),
    enabledLanguages: z
      .array(z.enum(Language, { message: 'Invalid language' }))
      .min(1)
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })
  .refine(
    (data) => {
      if (!data.defaultLanguage || !data.enabledLanguages) return true;
      return data.enabledLanguages.includes(data.defaultLanguage);
    },
    {
      message: 'enabledLanguages must include defaultLanguage',
      path: ['enabledLanguages'],
    }
  );
