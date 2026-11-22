import { Language } from '@prisma/client';
import { z } from 'zod';

/**
 * Shared new-password complexity (aligned with alua change-password / admin rules).
 */
const newPasswordSchema = z
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
  .trim();

/**
 * Request body for `POST /settings/password` (EMPLOYEE + SITE_MANAGER).
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: 'Current password is required' }),
    newPassword: newPasswordSchema,
  })
  .strict();

/**
 * Request body for `POST /settings/language` (EMPLOYEE + SITE_MANAGER).
 * Alua-compatible path used by the Flutter language picker.
 */
export const updateLanguageSchema = z
  .object({
    language: z.enum(Language, { message: 'Invalid language' }),
  })
  .strict();
