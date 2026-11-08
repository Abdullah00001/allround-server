import { z } from 'zod';

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
