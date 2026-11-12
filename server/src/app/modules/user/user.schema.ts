import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Admin-creatable workforce roles (excludes ADMIN).
 */
const workforceRoleSchema = z.enum([Role.EMPLOYEE, Role.SITE_MANAGER], {
  message: 'Role must be EMPLOYEE or SITE_MANAGER',
});

/**
 * Request body schema for `POST /admin/users`.
 */
export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, { message: 'First name is required' }),
    lastName: z.string().trim().min(1, { message: 'Last name is required' }),
    email: z.string().trim().email({ message: 'Invalid email' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' }),
    role: workforceRoleSchema,
    phone: z.string().trim().min(1).optional(),
    weeklyHoursTarget: z.number().positive().max(168).optional().default(40),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/users/:id`.
 * All fields optional; at least one field must be provided.
 */
export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().trim().email({ message: 'Invalid email' }).optional(),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .optional(),
    role: workforceRoleSchema.optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    weeklyHoursTarget: z.number().positive().max(168).optional(),
    status: z.enum(UserStatus, { message: 'Invalid status' }).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Query schema for `GET /admin/users`.
 */
export const getUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    search: z.string().trim().min(1).optional(),
    role: z.enum(Role, { message: 'Invalid role' }).optional(),
    status: z.enum(UserStatus, { message: 'Invalid status' }).optional(),
  })
  .strict();

/**
 * Path params schema for routes targeting a single managed user by UUID.
 */
export const userIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid user id' }),
  })
  .strict();
