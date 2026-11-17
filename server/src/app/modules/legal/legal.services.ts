import { LegalContent } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { LegalContentDTO } from '@/app/modules/legal/legal.dto';
import {
  TGetAdminLegalContentServiceParams,
  TGetLegalContentServiceParams,
  TUpdateLegalContentServiceParams,
} from '@/app/modules/legal/legal.types';

/**
 * Fetches published legal content by type for public / unauthenticated clients.
 *
 * @param {TGetLegalContentServiceParams} params - Legal content type.
 * @returns {Promise<LegalContentDTO | null>} DTO or null when missing.
 */
export const getLegalContentService = async ({
  type,
}: TGetLegalContentServiceParams): Promise<LegalContentDTO | null> => {
  const row = await prisma.legalContent.findUnique({
    where: { legalContentType: type },
  });
  if (!row) return null;
  return LegalContentDTO.build(row);
};

/**
 * Fetches legal content for the admin Legal tab.
 * Returns empty content when the type has never been published (editor blank state).
 *
 * @param {TGetAdminLegalContentServiceParams} params - Legal content type.
 * @returns {Promise<LegalContentDTO>} DTO (possibly empty).
 */
export const getAdminLegalContentService = async ({
  type,
}: TGetAdminLegalContentServiceParams): Promise<LegalContentDTO> => {
  const row = await prisma.legalContent.findUnique({
    where: { legalContentType: type },
  });
  if (!row) return LegalContentDTO.empty(type);
  return LegalContentDTO.build(row);
};

/**
 * Creates or updates legal content (admin Publish).
 *
 * @param {TUpdateLegalContentServiceParams} params - Type and HTML/markdown body.
 * @returns {Promise<LegalContent>} Upserted Prisma row.
 */
export const updateLegalContentService = async ({
  type,
  content,
}: TUpdateLegalContentServiceParams): Promise<LegalContent> => {
  return prisma.legalContent.upsert({
    where: { legalContentType: type },
    update: { content },
    create: { legalContentType: type, content },
  });
};
