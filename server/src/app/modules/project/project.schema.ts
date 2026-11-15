import { PhaseStatus, PhaseType, Priority } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';
import { createMobileProjectSchema } from '@/app/modules/mobile/mobile.schema';

/**
 * Admin project list tabs matching the Projects card-view filter strip.
 */
export const adminProjectTabEnum = z.enum([
  'ALL',
  'ACTIVE',
  'INSPECTION',
  'URGENT',
  'COMPLETED',
]);

/**
 * Query schema for `GET /admin/projects`.
 * Phase-centric cards with tab filters and multi-field search (parity with admin UI).
 */
export const getProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    search: z.string().trim().min(1).optional(),
    tab: adminProjectTabEnum.optional().default('ALL'),
    phaseType: z.enum(PhaseType, { message: 'Invalid phase type' }).optional(),
    status: z.enum(PhaseStatus, { message: 'Invalid status' }).optional(),
    priority: z.enum(Priority, { message: 'Invalid priority' }).optional(),
  })
  .strict();

/**
 * Path params schema for routes targeting a single project by UUID (`:id`).
 */
export const projectIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid project id' }),
  })
  .strict();

/**
 * Path params for admin child routes that mirror mobile (`:projectId`).
 */
export const adminProjectIdParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
  })
  .strict();

/**
 * Path params for admin project child resource (`:projectId` + `:id`).
 */
export const adminProjectChildIdParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    id: z.string().uuid({ error: 'Invalid resource id' }),
  })
  .strict();

/**
 * Path params for admin phase dates under a project.
 */
export const adminProjectPhaseDatesParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();

/**
 * Path params schema for routes targeting a single phase by UUID.
 */
export const phaseIdParamsSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/projects/:id` (Edit Master Data).
 * Aligns with mobile update fields plus address/city for the admin form.
 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).nullable().optional(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable()
      .optional(),
    budgetedHours: z.number().min(0).optional(),
    scaffoldArea: z.number().min(0).nullable().optional(),
    siteAccessCode: z.string().trim().min(1).nullable().optional(),
    siteAccessNotes: z.string().trim().min(1).nullable().optional(),
    phaseType: z.enum(PhaseType, { message: 'Invalid phase type' }).optional(),
    status: z.enum(PhaseStatus, { message: 'Invalid status' }).optional(),
    priority: z.enum(Priority, { message: 'Invalid priority' }).optional(),
    startDate: z.coerce.date({ error: 'Invalid start date' }).nullable().optional(),
    endDate: z.coerce.date({ error: 'Invalid end date' }).nullable().optional(),
    durationDays: z.number().positive().nullable().optional(),
    safetyInspectionComplete: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Admin create-project body — same as mobile create, but `siteManagerId` is required
 * (admin actors are not site managers).
 */
export const createAdminProjectSchema = createMobileProjectSchema.superRefine(
  (data, ctx) => {
    if (!data.siteManagerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'siteManagerId is required',
        path: ['siteManagerId'],
      });
    }
  }
);

/**
 * Request body schema for `POST /admin/projects/:id/phases`.
 * Creates a new Kanban phase under the project.
 */
export const createPhaseSchema = z
  .object({
    type: z.enum(PhaseType, { message: 'Invalid phase type' }),
    priority: z.enum(Priority, { message: 'Invalid priority' }).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict();

/**
 * Request body schema for `PATCH /admin/phases/:phaseId/status`.
 * Used by Kanban drag-and-drop; includes optional safety-inspection flag.
 */
export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(PhaseStatus, { message: 'Invalid phase status' }),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    priority: z.enum(Priority, { message: 'Invalid priority' }).optional(),
    safetyInspectionComplete: z.boolean().optional(),
  })
  .strict();
