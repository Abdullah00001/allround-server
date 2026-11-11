import { CustomerCategory } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Nested contact object accepted when creating a customer.
 * Enforces name/role and optional phone/email/primary flag.
 */
const contactInputSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Contact name is required' }),
    role: z.string().trim().min(1, { message: 'Contact role is required' }),
    phone: z.string().trim().min(1).optional(),
    email: z.email({ message: 'Invalid contact email address' }).optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

/**
 * Request body schema for `POST /admin/customers`.
 * Validates core customer fields and an optional contacts array with at most one primary.
 */
export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Customer name is required' }),
    category: z.enum(CustomerCategory, {
      message: 'Invalid customer category',
    }),
    address: z.string().trim().min(1, { message: 'Address is required' }),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    contacts: z
      .array(contactInputSchema)
      .max(20)
      .optional()
      .refine(
        (contacts) =>
          !contacts || contacts.filter((c) => c.isPrimary).length <= 1,
        { message: 'Only one primary contact is allowed' }
      ),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/customers/:id`.
 * All fields optional; at least one field must be present.
 */
export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: z.enum(CustomerCategory).optional(),
    address: z.string().trim().min(1).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Query schema for `GET /admin/customers`.
 * Coerces pagination values and optionally filters by search text or category.
 */
export const getCustomersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    search: z.string().trim().optional(),
    category: z.enum(CustomerCategory).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /admin/customers/:id/contacts`.
 * Validates contact person fields for an existing customer.
 */
export const createContactSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Contact name is required' }),
    role: z.string().trim().min(1, { message: 'Contact role is required' }),
    phone: z.string().trim().min(1).optional(),
    email: z.email({ message: 'Invalid contact email address' }).optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

/**
 * Path params schema for routes that target a single customer by UUID.
 */
export const customerIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid customer id' }),
  })
  .strict();
