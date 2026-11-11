import { InspectionStatus, PhaseType } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Request body schema for `POST /admin/inspections`.
 * Validates customer linkage, optional site manager, site details, and scaffold specs.
 */
export const createInspectionSchema = z
  .object({
    customerId: z.string().uuid({ error: 'Invalid customer id' }),
    siteManagerId: z.string().uuid({ error: 'Invalid site manager id' }).optional(),
    siteTitle: z.string().trim().min(1, { message: 'Site title is required' }),
    address: z.string().trim().min(1, { message: 'Address is required' }),
    postalCode: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    appointmentDate: z.coerce.date({
      error: 'Invalid appointment date',
    }),
    scaffoldArea: z.number().positive().optional(),
    scaffoldHeight: z.number().positive().optional(),
    scaffoldType: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/inspections/:id`.
 * All fields optional; at least one field must be provided.
 */
export const updateInspectionSchema = z
  .object({
    siteManagerId: z
      .string()
      .uuid({ error: 'Invalid site manager id' })
      .nullable()
      .optional(),
    siteTitle: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    postalCode: z.string().trim().min(1).nullable().optional(),
    city: z.string().trim().min(1).nullable().optional(),
    appointmentDate: z.coerce.date().optional(),
    scaffoldArea: z.number().positive().nullable().optional(),
    scaffoldHeight: z.number().positive().nullable().optional(),
    scaffoldType: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Query schema for `GET /admin/inspections`.
 * Supports pagination plus optional status and customer filters.
 */
export const getInspectionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    status: z.enum(InspectionStatus).optional(),
    customerId: z.string().uuid({ error: 'Invalid customer id' }).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /admin/inspections/:id/convert`.
 * Requires the new project name and initial phase type.
 */
export const convertInspectionSchema = z
  .object({
    projectName: z
      .string()
      .trim()
      .min(1, { message: 'Project name is required' }),
    phaseType: z.enum(PhaseType, {
      message: 'Invalid phase type',
    }),
  })
  .strict();

/**
 * Path params schema for routes targeting a single inspection by UUID.
 */
export const inspectionIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid inspection id' }),
  })
  .strict();
