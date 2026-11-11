import { PhaseStatus, PhaseType, Priority } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Query schema for `GET /admin/projects`.
 * Supports pagination and optional case-insensitive name search.
 */
export const getProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Path params schema for routes targeting a single project by UUID.
 */
export const projectIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid project id' }),
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
 * Request body schema for `PATCH /admin/projects/:id`.
 * All fields optional; at least one field must be provided.
 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    budgetedHours: z.number().min(0).optional(),
    siteAccessCode: z.string().trim().min(1).nullable().optional(),
    siteAccessNotes: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

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
 * Used by Kanban drag-and-drop to update status and optional schedule fields.
 */
export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(PhaseStatus, { message: 'Invalid phase status' }),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    priority: z.enum(Priority, { message: 'Invalid priority' }).optional(),
  })
  .strict();
