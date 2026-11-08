import { Role } from '@prisma/client';
import { z } from 'zod';

/**
 * @description This schema is for signup schema endpoint
 */
export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, { message: 'First name is required' }),
    lastName: z.string().trim().min(1, { message: 'Last name is required' }),
    email: z.email({ message: 'Invalid email address' }).trim().toLowerCase(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, { message: 'Phone number must be 10 digits long' })
      .optional(),
    role: z.enum(Role),
    password: z
      .string()
      .trim()
      .min(8, { message: 'Password must be at least 8 characters long' }),
  })
  .strict();

/**
 * @description This schema is for verify signup schema endpoint
 */
export const verifySignupSchema = z
  .object({
    otp: z.string().min(6, { error: 'Otp must be at least 6 characters long' }),
    deviceIdentifier: z
      .string({ error: 'Device identifier is required' })
      .min(1, { error: 'Device identifier is required' })
      .trim(),
    fcmToken: z.string().min(1).trim().optional(),
    platform: z.enum(
      ['ANDROID', 'IOS'],
      'error: Invalid platform. Please provide a valid platform'
    ),
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

/**
 * @description This schema is for check access token schema endpoint
 */
export const checkAccessTokenSchema = z
  .object({
    deviceIdentifier: z.string().min(1, 'Device Identifier is required'),
    lat: z.number(),
    lng: z.number(),
    platform: z.enum(['ANDROID', 'IOS']),
    fcmToken: z.string().optional(),
  })
  .strict();

/**
 * @description
 */

export const loginSchema = z
  .object({
    email: z
      .email({ error: 'Please provide a valid email address' })
      .toLowerCase(),
    password: z.string().min(1, { error: 'Password is required' }),
    role: z.enum(Role),
    deviceIdentifier: z
      .string({ error: 'Device identifier is required' })
      .min(1, { error: 'Device identifier is required' })
      .trim(),
    fcmToken: z.string().min(1).trim().optional(),
    platform: z.enum(['ANDROID', 'IOS']),
    lat: z.number(),
    lng: z.number(),
    rememberMe: z.boolean().default(false),
  })
  .strict();
