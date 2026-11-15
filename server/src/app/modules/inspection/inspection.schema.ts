import {
  CustomerCategory,
  InspectionStatus,
  PhaseType,
} from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Optional inspection photo URL after `POST /media` upload.
 */
const inspectionPhotoSchema = z
  .object({
    url: z.string().url({ message: 'Invalid photo URL' }),
    fileType: z.string().trim().min(1, { message: 'fileType is required' }),
    fileName: z.string().trim().min(1).optional(),
    fileSize: z.number().int().positive().optional(),
  })
  .strict();

/**
 * Optional contact person (stored as `CustomerContact`, not on Inspection).
 */
const inspectionContactSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Contact name is required' }),
    phone: z.string().trim().min(1).optional(),
    email: z.string().trim().email({ message: 'Invalid contact email' }).optional(),
    role: z.string().trim().min(1).optional().default('Project lead'),
  })
  .strict();

/**
 * Shared site / schedule / scaffold fields for create + nested under customer modes.
 */
const inspectionSiteFields = {
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
  siteAccessInstructions: z.string().trim().min(1).optional(),
  specialRequirements: z.string().trim().min(1).optional(),
  photos: z.array(inspectionPhotoSchema).max(6).optional(),
  contact: inspectionContactSchema.optional(),
};

/**
 * Request body schema for `POST /admin/inspections`.
 * Customer: EXISTING (customerId) or NEW (creates Customer + optional contact).
 * Notes/photos mirror mobile survey fields (`siteAccessInstructions`,
 * `specialRequirements`, `Attachment` PHOTO) for admin↔app parity.
 */
export const createInspectionSchema = z
  .object({
    customer: z.discriminatedUnion('mode', [
      z
        .object({
          mode: z.literal('EXISTING'),
          customerId: z.string().uuid({ error: 'Invalid customer id' }),
        })
        .strict(),
      z
        .object({
          mode: z.literal('NEW'),
          name: z.string().trim().min(1, { message: 'Customer name is required' }),
          category: z
            .enum(CustomerCategory, { message: 'Invalid category' })
            .optional()
            .default(CustomerCategory.COMMERCIAL),
        })
        .strict(),
    ]),
    ...inspectionSiteFields,
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/inspections/:id`.
 * All fields optional; at least one field must be provided.
 * When `photos` is sent, PHOTO attachments are replaced (max 6).
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
    siteAccessInstructions: z.string().trim().min(1).nullable().optional(),
    specialRequirements: z.string().trim().min(1).nullable().optional(),
    photos: z.array(inspectionPhotoSchema).max(6).optional(),
    contact: inspectionContactSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Query schema for `GET /admin/inspections`.
 * Supports pagination, status tab, customer id, and customer-name search.
 */
export const getInspectionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    status: z.enum(InspectionStatus).optional(),
    customerId: z.string().uuid({ error: 'Invalid customer id' }).optional(),
    search: z.string().trim().min(1).optional(),
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
