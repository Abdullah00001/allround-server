import { z } from 'zod';

/**
 * Find recover user by email schema
 */
export const findRecoverUserByEmailSchema = z
  .object({
    email: z.email({ message: 'Invalid email address' }).trim().toLowerCase(),
  })
  .strict();

/**
 * Verify recover user otp schema
 */
export const verifyRecoverUserOtpSchema = z
  .object({
    otp: z
      .string()
      .length(6, 'Otp must be 6 digits')
      .regex(/^[0-9]{6}$/, 'Otp must contain only numbers'),
  })
  .strict();

export const resetRecoverUserPasswordSchema = z
  .object({
    password: z
      .string()
      .trim()
      .min(6, { error: 'Password must be at least 6 characters long' })
      .max(16, { error: 'Password must not exceed 16 characters' })
      .regex(/[A-Z]/, {
        error: 'Password must contain at least one uppercase letter',
      })
      .regex(/[a-z]/, {
        error: 'Password must contain at least one lowercase letter',
      })
      .regex(/[0-9]/, { error: 'Password must contain at least one number' })
      .regex(/[^A-Za-z0-9]/, {
        error: 'Password must contain at least one special character',
      }),
    confirmPassword: z
      .string()
      .trim()
      .min(1, { error: 'Confirm password is required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  });
