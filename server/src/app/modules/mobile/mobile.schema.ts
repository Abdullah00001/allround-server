import {
  ActivityType,
  AttachmentCategory,
  CustomerCategory,
  MeasurementUnit,
  PhaseStatus,
  PhaseType,
  Priority,
  ProjectNoteCategory,
} from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/const';

/**
 * Shared page/limit query fields (admin + alua-compatible).
 */
const paginationQueryFields = {
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LIMIT),
};

/**
 * Note categories exposed to the mobile UI (legacy SAFETY/INTERNAL omitted).
 */
const mobileNoteCategoryEnum = z.enum(
  [
    ProjectNoteCategory.SITE_ACCESS,
    ProjectNoteCategory.CUSTOMER_REQUEST,
    ProjectNoteCategory.OPEN_POINTS,
    ProjectNoteCategory.AGREEMENTS,
    ProjectNoteCategory.SPECIAL_REQUIREMENTS,
    ProjectNoteCategory.LOCAL_CONTACT,
    ProjectNoteCategory.GENERAL,
  ],
  { message: 'Invalid note category' }
);

/**
 * Request body schema for `POST /mobile/timer/start`.
 */
export const startTimerSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
    gpsStartLat: z.number().min(-90).max(90).optional(),
    gpsStartLng: z.number().min(-180).max(180).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /mobile/timer/stop`.
 */ 
export const stopTimerSchema = z
  .object({
    timeLogId: z.string().uuid({ error: 'Invalid time log id' }),
    gpsEndLat: z.number().min(-90).max(90).optional(),
    gpsEndLng: z.number().min(-180).max(180).optional(),
  })
  .strict();

/**
 * Request body schema for `POST /mobile/timer/manual`.
 */
export const manualTimeSchema = z
  .object({
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
    startTime: z.coerce.date({ error: 'Invalid start time' }),
    endTime: z.coerce.date({ error: 'Invalid end time' }),
    breakMinutes: z.number().int().min(0).default(0),
  })
  .strict()
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

/**
 * Single offline sync log entry.
 */
const syncTimeLogItemSchema = z
  .object({
    clientSyncId: z.string().trim().min(1, { message: 'clientSyncId is required' }),
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
    activityType: z.enum(ActivityType, { message: 'Invalid activity type' }),
    startTime: z.coerce.date({ error: 'Invalid start time' }),
    endTime: z.coerce.date({ error: 'Invalid end time' }),
    breakMinutes: z.number().int().min(0).default(0),
  })
  .strict()
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

/**
 * Request body schema for `POST /mobile/sync`.
 */
export const syncTimeLogsSchema = z
  .object({
    logs: z.array(syncTimeLogItemSchema).min(1, {
      message: 'At least one log is required',
    }),
  })
  .strict();

/**
 * Query schema for `GET /mobile/dashboard` (paginates `upcomingTasks` + `mapPins`).
 */
export const getDashboardQuerySchema = z
  .object({
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/time-logs`.
 * Filters the authenticated user's logs to today, this week, or this month (UTC).
 */
export const getMyTimeLogsQuerySchema = z
  .object({
    period: z.enum(['TODAY', 'WEEK', 'MONTH']).default('TODAY'),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/schedule`.
 * Inclusive calendar window used to find overlapping scheduled phases.
 */
export const getScheduleQuerySchema = z
  .object({
    startDate: z.coerce.date({ error: 'Invalid startDate' }),
    endDate: z.coerce.date({ error: 'Invalid endDate' }),
    ...paginationQueryFields,
  })
  .strict()
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

/**
 * Query schema for `GET /mobile/map`.
 * Optional phase-type filter for map pins.
 */
export const getMapQuerySchema = z
  .object({
    type: z.enum(PhaseType, { message: 'Invalid phase type' }).optional(),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/crew-time`.
 * Project-scoped crew aggregation with optional UTC calendar-day filter.
 * `page`/`limit` paginate the `logs` array; aggregates stay full-window.
 */
export const getCrewTimeQuerySchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    date: z.coerce.date({ error: 'Invalid date' }).optional(),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Path params schema for mobile inspection `/:id` routes.
 */
export const mobileInspectionIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid inspection id' }),
  })
  .strict();

/**
 * Path params schema for `PATCH /mobile/phases/:id/status`.
 */
export const mobilePhaseIdParamsSchema = z
  .object({
    id: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();

/**
 * Request body schema for `PATCH /mobile/inspections/:id/complete`.
 * Saves survey scaffold specs, optional notes/photos, and optional convert-to-project.
 */
export const completeInspectionSchema = z
  .object({
    scaffoldArea: z.number().positive({ message: 'Scaffold area must be positive' }),
    scaffoldHeight: z
      .number()
      .positive({ message: 'Scaffold height must be positive' }),
    scaffoldType: z.string().trim().min(1, { message: 'Scaffold type is required' }),
    siteAccessInstructions: z.string().trim().min(1).optional(),
    specialRequirements: z.string().trim().min(1).optional(),
    photos: z
      .array(
        z
          .object({
            url: z.string().url({ message: 'Invalid photo URL' }),
            fileType: z.string().trim().min(1, { message: 'fileType is required' }),
          })
          .strict()
      )
      .max(20)
      .optional(),
    convertToProject: z.boolean().optional().default(false),
    projectName: z.string().trim().min(1).optional(),
    phaseType: z.enum(PhaseType, { message: 'Invalid phase type' }).optional(),
  })
  .strict();

/**
 * Request body schema for `PATCH /mobile/phases/:id/status`.
 * Restricted to mobile board transitions.
 */
export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(
      [PhaseStatus.IN_PROGRESS, PhaseStatus.COMPLETED, PhaseStatus.POSTPONED],
      { message: 'Invalid phase status' }
    ),
  })
  .strict();

/**
 * Preprocesses a query value that may arrive as a comma-separated string
 * or as a repeated query-array into a string array for Zod validation.
 *
 * @param {unknown} value - Raw query value from Express.
 * @returns {unknown} Normalized string array, `undefined`, or the original value.
 */
const preprocessCsvOrArray = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return value;
};

/**
 * Builds an optional array query schema that accepts CSV strings or arrays.
 *
 * @template T
 * @param {z.ZodType<T>} itemSchema - Schema for each array element.
 * @returns {z.ZodType<T[] | undefined>} Optional non-empty array schema.
 */
const csvOrArray = <T>(itemSchema: z.ZodType<T>) =>
  z.preprocess(
    preprocessCsvOrArray,
    z.array(itemSchema).min(1).optional()
  );

/**
 * Query schema for `GET /mobile/projects` (tabs + filter modal + sort).
 */
export const getMyProjectsQuerySchema = z
  .object({
    tab: z
      .enum(['ALL', 'ACTIVE', 'MY_PROJECTS', 'THIS_WEEK', 'INSPECTION'], {
        message: 'Invalid tab',
      })
      .optional()
      .default('ALL'),
    search: z.string().trim().min(1).optional(),
    phaseTypes: csvOrArray(
      z.enum(PhaseType, { message: 'Invalid phase type' })
    ),
    phaseStatuses: csvOrArray(
      z.enum(PhaseStatus, { message: 'Invalid phase status' })
    ),
    priorities: csvOrArray(
      z.enum(Priority, { message: 'Invalid priority' })
    ),
    categories: csvOrArray(
      z.enum(CustomerCategory, { message: 'Invalid category' })
    ),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional().default(25),
    sortBy: z
      .enum(['NEWEST', 'NEXT_INSPECTION', 'NAME_AZ'], {
        message: 'Invalid sortBy',
      })
      .optional()
      .default('NEWEST'),
    ...paginationQueryFields,
  })
  .strict()
  .refine(
    (data) =>
      (data.lat === undefined && data.lng === undefined) ||
      (data.lat !== undefined && data.lng !== undefined),
    { message: 'lat and lng must be provided together', path: ['lat'] }
  );

/**
 * Query schema for `GET /mobile/phases` Phase Board columns.
 */
export const getMobilePhasesQuerySchema = z
  .object({
    column: z
      .enum(['ENQUIRY', 'ERECTION', 'DISMANTLING', 'STANDING'], {
        message: 'Invalid phase board column',
      })
      .optional(),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/inspections` Pending/Completed tabs.
 */
export const getMobileInspectionsQuerySchema = z
  .object({
    status: z
      .enum(['PENDING', 'COMPLETED'], { message: 'Invalid inspection status' })
      .optional()
      .default('PENDING'),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/projects/:projectId/attachments`.
 */
export const getProjectAttachmentsQuerySchema = z
  .object({
    category: z
      .enum([AttachmentCategory.PHOTO, AttachmentCategory.PDF_PLAN], {
        message: 'Invalid attachment category',
      })
      .optional(),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for `GET /mobile/projects/:projectId/tasks`.
 * Optional `status` returns one tab as a flat paginated array; omit for both buckets.
 */
export const getProjectTasksQuerySchema = z
  .object({
    status: z
      .enum(['OPEN', 'COMPLETED'], { message: 'Invalid task status' })
      .optional(),
    ...paginationQueryFields,
  })
  .strict();

/**
 * Query schema for project child lists that only need page/limit
 * (notes, measurements, history).
 */
export const getProjectListQuerySchema = z
  .object({
    ...paginationQueryFields,
  })
  .strict();

/**
 * Path params for `/:projectId` mobile project routes.
 */
export const mobileProjectIdParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
  })
  .strict();

/**
 * Path params for `/:taskId` mobile task routes.
 */
export const mobileTaskIdParamsSchema = z
  .object({
    taskId: z.string().uuid({ error: 'Invalid task id' }),
  })
  .strict();

/**
 * Path params for project-scoped measurement/note/attachment `/:id` deletes.
 */
export const mobileProjectChildIdParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    id: z.string().uuid({ error: 'Invalid resource id' }),
  })
  .strict();

/**
 * Path params for `PATCH /mobile/projects/:projectId/phases/:phaseId/dates`.
 */
export const mobileProjectPhaseDatesParamsSchema = z
  .object({
    projectId: z.string().uuid({ error: 'Invalid project id' }),
    phaseId: z.string().uuid({ error: 'Invalid phase id' }),
  })
  .strict();

/**
 * Request body for creating a project task.
 */
export const createProjectTaskSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, { message: 'Description is required' }),
    employeeId: z.string().uuid({ error: 'Invalid employee id' }),
    priority: z.enum(Priority, { message: 'Invalid priority' }),
    dueDate: z.coerce.date({ error: 'Invalid due date' }).optional(),
  })
  .strict();

/**
 * Request body for adding a measurement line item.
 */
export const createMeasurementSchema = z
  .object({
    position: z.string().trim().min(1).optional(),
    length: z.number().positive({ message: 'Length must be positive' }),
    height: z.number().positive({ message: 'Height must be positive' }),
    quantity: z.number().positive({ message: 'Quantity must be positive' }),
    unit: z.enum(MeasurementUnit, { message: 'Invalid unit' }).default('M'),
    remark: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Request body for creating a project note.
 */
export const createProjectNoteSchema = z
  .object({
    category: mobileNoteCategoryEnum,
    content: z.string().trim().min(1, { message: 'Content is required' }),
  })
  .strict();

/**
 * Request body for updating a project note.
 */
export const updateProjectNoteSchema = z
  .object({
    category: mobileNoteCategoryEnum.optional(),
    content: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Request body for updating a measurement line item.
 */
export const updateMeasurementSchema = z
  .object({
    position: z.string().trim().min(1).nullable().optional(),
    length: z.number().positive({ message: 'Length must be positive' }).optional(),
    height: z.number().positive({ message: 'Height must be positive' }).optional(),
    quantity: z
      .number()
      .positive({ message: 'Quantity must be positive' })
      .optional(),
    unit: z.enum(MeasurementUnit, { message: 'Invalid unit' }).optional(),
    remark: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update',
  });

/**
 * Untyped schedule entry (legacy erection/dismantling arrays).
 */
const mobilePhaseScheduleSchema = z
  .object({
    startDate: z.coerce.date({ error: 'Invalid start date' }),
    durationDays: z
      .number()
      .min(0, { message: 'Duration must be zero or positive' }),
  })
  .strict();

/**
 * Flutter Activity Type values (lowercase) for `scheduleData[].type`.
 */
export const mobileScheduleActivityTypes = [
  'erection',
  'dismantling',
  'standing',
  'other',
] as const;

/**
 * Maps Flutter schedule activity type → Prisma `PhaseType`.
 */
export const mapScheduleActivityToPhaseType = (
  type: (typeof mobileScheduleActivityTypes)[number]
): PhaseType => {
  switch (type) {
    case 'erection':
      return PhaseType.ERECTION;
    case 'dismantling':
      return PhaseType.DISMANTLING;
    case 'standing':
      return PhaseType.STANDING;
    case 'other':
      return PhaseType.MAINTENANCE;
  }
};

/**
 * Maps Prisma `PhaseType` → Flutter schedule activity type.
 */
export const mapPhaseTypeToScheduleActivity = (
  type: PhaseType
): (typeof mobileScheduleActivityTypes)[number] => {
  switch (type) {
    case PhaseType.ERECTION:
      return 'erection';
    case PhaseType.DISMANTLING:
      return 'dismantling';
    case PhaseType.STANDING:
      return 'standing';
    case PhaseType.MAINTENANCE:
      return 'other';
  }
};

/**
 * Typed schedule entry for Flutter Activity Type picker (`scheduleData`).
 * Same shape on create + detail (detail also returns `id`).
 * Scaffold Erection→erection, Dismantling→dismantling, Standing→standing, Other→other.
 *
 * Rules: `startDate` required. Provide `endDate` and/or `durationDays`.
 * - both → `endDate` stored; `durationDays` used as sent (or derived if omitted)
 * - only `durationDays` → `endDate = startDate + durationDays`
 * - only `endDate` → `durationDays` derived from date difference
 */
const mobileTypedScheduleSchema = z
  .object({
    type: z.enum(mobileScheduleActivityTypes, {
      message: 'Invalid activity type',
    }),
    startDate: z.coerce.date({ error: 'Invalid start date' }),
    endDate: z.coerce.date({ error: 'Invalid end date' }).optional(),
    durationDays: z
      .number()
      .min(0, { message: 'Duration must be zero or positive' })
      .optional(),
  })
  .strict()
  .refine(
    (data) => data.endDate !== undefined || data.durationDays !== undefined,
    {
      message: 'Either endDate or durationDays is required',
      path: ['endDate'],
    }
  );

/**
 * Request body for `POST /mobile/projects` (Site Manager create from map).
 * Location is required as map coordinates; optional `placeLabel` fills DB address.
 */
export const createMobileProjectSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Project name is required' }),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict(),
    placeLabel: z.string().trim().min(1).optional(),
    /**
     * Scaffold specification shown on project detail.
     * `area` → Project.scaffoldArea; `height`/`type` seed an initial measurement.
     */
    scaffoldSpecification: z
      .object({
        area: z.number().positive({ message: 'Scaffold area must be positive' }),
        height: z.number().positive({ message: 'Scaffold height must be positive' }).optional(),
        type: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    /** @deprecated Prefer `scaffoldSpecification.area`. */
    scaffoldArea: z.number().positive().optional(),
    priority: z
      .enum(Priority, { message: 'Invalid priority' })
      .optional()
      .default(Priority.MEDIUM),
    phaseType: z
      .enum(PhaseType, { message: 'Invalid phase type' })
      .optional()
      .default(PhaseType.ERECTION),
    status: z
      .enum(PhaseStatus, { message: 'Invalid status' })
      .optional()
      .default(PhaseStatus.ENQUIRY),
    siteManagerId: z.string().uuid({ error: 'Invalid site manager id' }).optional(),
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
    contact: z
      .object({
        name: z.string().trim().min(1, { message: 'Contact name is required' }),
        phone: z.string().trim().optional(),
        email: z
          .string()
          .trim()
          .email({ message: 'Invalid contact email' })
          .optional(),
        role: z.string().trim().min(1).optional().default('Project lead'),
      })
      .strict(),
    scheduleData: z.array(mobileTypedScheduleSchema).min(1).optional(),
    /** @deprecated Prefer `scheduleData`. */
    schedules: z.array(mobileTypedScheduleSchema).min(1).optional(),
    /** @deprecated Prefer `scheduleData` with `type: "erection"`. */
    erection: z.array(mobilePhaseScheduleSchema).min(1).optional(),
    /** @deprecated Prefer `scheduleData` with `type: "dismantling"`. */
    dismantling: z.array(mobilePhaseScheduleSchema).min(1).optional(),
    note: z
      .object({
        category: mobileNoteCategoryEnum,
        content: z.string().trim().min(1, { message: 'Note content is required' }),
      })
      .strict()
      .optional(),
    photos: z
      .array(
        z
          .object({
            url: z.string().url({ message: 'Invalid photo URL' }),
            fileType: z.string().trim().min(1),
            fileName: z.string().trim().min(1).optional(),
            fileSize: z.number().int().positive().optional(),
            isCover: z.boolean().optional(),
          })
          .strict()
      )
      .max(20)
      .optional(),
  })
  .strict();

/**
 * Request body for elaborating project edit (all project fields except customer).
 */
export const updateMobileProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable()
      .optional(),
    budgetedHours: z.number().min(0).optional(),
    scaffoldArea: z.number().min(0).nullable().optional(),
    scaffoldSpecification: z
      .object({
        area: z.number().min(0).nullable().optional(),
        height: z.number().positive().nullable().optional(),
        type: z.string().trim().min(1).nullable().optional(),
      })
      .strict()
      .optional(),
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
 * Request body for updating phase dates / safety inspection flag.
 */
export const updatePhaseDatesSchema = z
  .object({
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
 * Request body for registering a project attachment (after S3 upload).
 */
export const createProjectAttachmentSchema = z
  .object({
    url: z.string().url({ message: 'Invalid attachment URL' }),
    fileType: z.string().trim().min(1, { message: 'fileType is required' }),
    fileName: z.string().trim().min(1).optional(),
    fileSize: z.number().int().positive().optional(),
    isCover: z.boolean().optional(),
    category: z.enum([AttachmentCategory.PHOTO, AttachmentCategory.PDF_PLAN], {
      message: 'Invalid attachment category',
    }),
  })
  .strict();

/**
 * Query schema for `GET /mobile/customers`.
 * Coerces pagination values and optionally filters by search text or category.
 */
export const getMobileCustomersQuerySchema = z
  .object({
    ...paginationQueryFields,
    search: z.string().trim().optional(),
    category: z.enum(CustomerCategory).optional(),
  })
  .strict();

