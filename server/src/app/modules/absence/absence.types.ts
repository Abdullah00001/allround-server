import { z } from 'zod';
import { Absence } from '@prisma/client';
import {
  createAbsenceSchema,
  getAbsencesQuerySchema,
} from '@/app/modules/absence/absence.schema';

/**
 * Validated list-absences query string.
 */
export type TGetAbsencesQuery = z.infer<typeof getAbsencesQuerySchema>;

/**
 * Validated create-absence request body.
 */
export type TCreateAbsencePayload = z.infer<typeof createAbsenceSchema>;

/**
 * Service params for listing absences.
 */
export type TListAbsencesServiceParams = {
  /** Validated list query. */
  query: TGetAbsencesQuery;
};

/**
 * Service params for creating an absence.
 */
export type TCreateAbsenceServiceParams = {
  /** Validated create payload. */
  payload: TCreateAbsencePayload;
};

/**
 * Service params for deleting an absence.
 */
export type TDeleteAbsenceServiceParams = {
  /** Trusted absence from existence middleware. */
  absence: Absence;
};
