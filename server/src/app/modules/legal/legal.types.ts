import { z } from 'zod';
import { LegalContentType } from '@prisma/client';
import {
  legalTypeParamSchema,
  updateLegalContentSchema,
} from '@/app/modules/legal/legal.schema';

export type TLegalTypeParam = z.infer<typeof legalTypeParamSchema>;

export type TUpdateLegalContentPayload = z.infer<
  typeof updateLegalContentSchema
>;

export type TGetLegalContentServiceParams = {
  type: LegalContentType;
};

export type TGetAdminLegalContentServiceParams = {
  type: LegalContentType;
};

export type TUpdateLegalContentServiceParams = {
  type: LegalContentType;
  content: string;
};

export type TLegalContentResponseData = {
  legalContentType: LegalContentType;
  content: string;
  updatedAt: Date | null;
};
