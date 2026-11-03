import { Role } from '@prisma/client';
import { z } from 'zod';

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