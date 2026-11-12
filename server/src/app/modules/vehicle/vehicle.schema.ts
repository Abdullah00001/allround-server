import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Request body schema for `POST /admin/vehicles`.
 */
export const createVehicleSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }),
    plateNumber: z
      .string()
      .trim()
      .min(1, { message: 'Plate number is required' }),
    imageUrl: z.string().url({ message: 'Invalid image URL' }).optional(),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/vehicles/:id`.
 * All fields optional; at least one field must be provided.
 */
export const updateVehicleSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    plateNumber: z.string().trim().min(1).optional(),
    imageUrl: z
      .string()
      .url({ message: 'Invalid image URL' })
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Query schema for `GET /admin/vehicles`.
 */
export const getVehiclesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Path params schema for routes targeting a single vehicle by UUID.
 */
export const vehicleIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid vehicle id' }),
  })
  .strict();
