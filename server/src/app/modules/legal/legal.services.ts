import { LegalContent } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { getLocale } from '@/app/configs/requestContext.configs';
import { LegalContentDTO } from '@/app/modules/legal/legal.dto';
import {
  TGetAdminLegalContentServiceParams,
  TGetLegalContentServiceParams,
  TUpdateLegalContentServiceParams,
} from '@/app/modules/legal/legal.types';
import {
  computeSourceHash,
  getOrTranslateContent,
  invalidateStaleTranslations,
  preTranslateContent,
} from '@/app/services/translation/translation.service';
import { TRANSLATION_CONFIG } from '@/const';

/**
 * Fetches published legal content by type for public / unauthenticated clients.
 * Localizes `content` to the active request locale when a translation exists
 * (or enqueues async translation and returns source meanwhile).
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

  const targetLocale = getLocale();
  const sourceLocale = TRANSLATION_CONFIG.DEFAULT_LOCALE;

  const translationResult = await getOrTranslateContent({
    contentType: 'LEGAL_CONTENT',
    contentId: row.id,
    sourceLocale,
    targetLocale,
    fields: { content: row.content },
  });

  const localizedContent =
    typeof translationResult.fields.content === 'string'
      ? translationResult.fields.content
      : row.content;

  return new LegalContentDTO(
    row.legalContentType,
    localizedContent,
    row.updatedAt
  );
};

/**
 * Fetches legal content for the admin Legal tab (source locale, no machine translate).
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
 * Invalidates stale translations and pre-translates into enabled company languages.
 *
 * @param {TUpdateLegalContentServiceParams} params - Type and HTML/markdown body.
 * @returns {Promise<LegalContent>} Upserted Prisma row.
 */
export const updateLegalContentService = async ({
  type,
  content,
}: TUpdateLegalContentServiceParams): Promise<LegalContent> => {
  const legalContent = await prisma.legalContent.upsert({
    where: { legalContentType: type },
    update: { content },
    create: { legalContentType: type, content },
  });

  const newHash = computeSourceHash({ content });
  const sourceLocale = TRANSLATION_CONFIG.DEFAULT_LOCALE;

  invalidateStaleTranslations({
    contentType: 'LEGAL_CONTENT',
    contentId: legalContent.id,
    currentSourceHash: newHash,
  }).catch((err) => {
    logger.error('Failed to invalidate stale legal content translations:', err);
  });

  preTranslateContent({
    contentType: 'LEGAL_CONTENT',
    contentId: legalContent.id,
    sourceLocale,
    fields: { content },
  }).catch((err) => {
    logger.error('Failed to pre-translate legal content:', err);
  });

  return legalContent;
};
