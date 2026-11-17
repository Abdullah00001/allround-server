import { z } from 'zod';
import { Project, ProjectPhase, User } from '@prisma/client';
import {
  createAdminProjectSchema,
  createPhaseSchema,
  getAdminPhasesQuerySchema,
  getProjectsQuerySchema,
  updatePhaseStatusSchema,
  updateProjectSchema,
} from '@/app/modules/project/project.schema';
import {
  getMapQuerySchema,
  getScheduleQuerySchema,
} from '@/app/modules/mobile/mobile.schema';

/**
 * Validated list-projects query string.
 */
export type TGetProjectsQuery = z.infer<typeof getProjectsQuerySchema>;

/**
 * Validated admin phase-board list query.
 */
export type TGetAdminPhasesQuery = z.infer<typeof getAdminPhasesQuerySchema>;

/**
 * Validated admin schedule window query (mobile parity).
 */
export type TGetAdminScheduleQuery = z.infer<typeof getScheduleQuerySchema>;

/**
 * Validated admin map query (mobile parity).
 */
export type TGetAdminMapQuery = z.infer<typeof getMapQuerySchema>;

/**
 * Validated update-project request body.
 */
export type TUpdateProjectPayload = z.infer<typeof updateProjectSchema>;

/**
 * Validated admin create-project body.
 */
export type TCreateAdminProjectPayload = z.infer<typeof createAdminProjectSchema>;

/**
 * Validated create-phase request body.
 */
export type TCreatePhasePayload = z.infer<typeof createPhaseSchema>;

/**
 * Validated update-phase-status request body.
 */
export type TUpdatePhaseStatusPayload = z.infer<typeof updatePhaseStatusSchema>;

/**
 * Compact customer projection used inside project DTOs.
 */
export type TProjectCustomerRef = {
  id: string;
  name: string;
};

/**
 * Compact user projection used for assigned crew members.
 */
export type TProjectCrewMemberRef = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'email'
>;

/**
 * Service params for listing projects.
 */
export type TListProjectsServiceParams = {
  /** Validated list query. */
  query: TGetProjectsQuery;
};

/**
 * Service params for listing admin phase-board rows.
 */
export type TListAdminPhasesServiceParams = {
  /** Validated column / pagination query. */
  query: TGetAdminPhasesQuery;
};

/**
 * Service params for admin calendar schedule.
 */
export type TGetAdminScheduleServiceParams = {
  /** Inclusive startDate/endDate window. */
  query: TGetAdminScheduleQuery;
};

/**
 * Service params for admin map pins.
 */
export type TGetAdminMapServiceParams = {
  /** Optional phase type filter. */
  query: TGetAdminMapQuery;
};

/**
 * Service params for fetching one project with aggregations.
 */
export type TGetProjectByIdServiceParams = {
  /** Trusted project already verified by existence middleware. */
  project: Project;
};

/**
 * Service params for updating project master data.
 */
export type TUpdateProjectServiceParams = {
  /** Trusted project from existence middleware. */
  project: Project;
  /** Validated partial update payload. */
  payload: TUpdateProjectPayload;
};

/**
 * Service params for soft-deleting a project.
 */
export type TDeleteProjectServiceParams = {
  /** Trusted project from existence middleware. */
  project: Project;
};

/**
 * Service params for creating a phase under a project.
 */
export type TCreatePhaseServiceParams = {
  /** Trusted project from existence middleware. */
  project: Project;
  /** Validated create-phase payload. */
  payload: TCreatePhasePayload;
};

/**
 * Service params for Kanban phase status updates.
 */
export type TUpdatePhaseStatusServiceParams = {
  /** Trusted phase from existence middleware. */
  phase: ProjectPhase;
  /** Validated status/schedule payload. */
  payload: TUpdatePhaseStatusPayload;
  /** Authenticated admin user id for AuditLog authorship. */
  actorUserId: string;
};
