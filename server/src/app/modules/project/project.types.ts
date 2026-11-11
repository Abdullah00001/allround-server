import { z } from 'zod';
import { Project, ProjectPhase, User } from '@prisma/client';
import {
  createPhaseSchema,
  getProjectsQuerySchema,
  updatePhaseStatusSchema,
  updateProjectSchema,
} from '@/app/modules/project/project.schema';

/**
 * Validated list-projects query string.
 */
export type TGetProjectsQuery = z.infer<typeof getProjectsQuerySchema>;

/**
 * Validated update-project request body.
 */
export type TUpdateProjectPayload = z.infer<typeof updateProjectSchema>;

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
