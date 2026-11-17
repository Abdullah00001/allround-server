import { LegalContentType } from '@prisma/client';
import { z } from 'zod';

/**
 * Path params for `/legal/:type` and `/admin/legal/:type`.
 * Types match Prisma `LegalContentType` (UI: Privacy → PRIVACY_AND_POLICY, Terms → TERMS_AND_CONDITION).
 */
export const legalTypeParamSchema = z
  .object({
    type: z.enum(LegalContentType, {
      message: 'Invalid legal content type',
    }),
  })
  .strict();

/**
 * Request body for `PATCH /admin/legal/:type` (Publish).
 */
export const updateLegalContentSchema = z
  .object({
    content: z
      .string({ error: 'Content is required' })
      .min(1, { message: 'Content cannot be empty' }),
  })
  .strict();
