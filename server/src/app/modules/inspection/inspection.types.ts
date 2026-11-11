import { z } from 'zod';
import { Customer, Inspection, User } from '@prisma/client';
import {
  convertInspectionSchema,
  createInspectionSchema,
  getInspectionsQuerySchema,
  updateInspectionSchema,
} from '@/app/modules/inspection/inspection.schema';

/**
 * Validated create-inspection request body.
 */
export type TCreateInspectionPayload = z.infer<typeof createInspectionSchema>;

/**
 * Validated update-inspection request body.
 */
export type TUpdateInspectionPayload = z.infer<typeof updateInspectionSchema>;

/**
 * Validated list-inspections query string.
 */
export type TGetInspectionsQuery = z.infer<typeof getInspectionsQuerySchema>;

/**
 * Validated convert-inspection request body.
 */
export type TConvertInspectionPayload = z.infer<typeof convertInspectionSchema>;

/**
 * Compact customer projection used inside inspection DTOs.
 */
export type TInspectionCustomerRef = Pick<Customer, 'id' | 'name'>;

/**
 * Compact site-manager projection used inside inspection DTOs.
 */
export type TInspectionSiteManagerRef = Pick<
  User,
  'id' | 'firstName' | 'lastName'
>;

/**
 * Service params for creating an inspection.
 */
export type TCreateInspectionServiceParams = {
  /** Validated create payload. */
  payload: TCreateInspectionPayload;
};

/**
 * Service params for listing inspections.
 */
export type TListInspectionsServiceParams = {
  /** Validated list query. */
  query: TGetInspectionsQuery;
};

/**
 * Service params for fetching one inspection.
 */
export type TGetInspectionByIdServiceParams = {
  /** Trusted inspection already verified by existence middleware. */
  inspection: Inspection;
};

/**
 * Service params for updating an inspection.
 */
export type TUpdateInspectionServiceParams = {
  /** Trusted inspection from existence middleware. */
  inspection: Inspection;
  /** Validated partial update payload. */
  payload: TUpdateInspectionPayload;
};

/**
 * Service params for converting an inspection into a project.
 */
export type TConvertInspectionServiceParams = {
  /** Trusted convertible inspection from middleware. */
  inspection: Inspection;
  /** Validated convert payload (project name + phase type). */
  payload: TConvertInspectionPayload;
};
