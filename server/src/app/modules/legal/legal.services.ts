import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { LegalContentDTO } from '@/app/modules/legal/legal.dto';
import {
  TGetAdminLegalContentServiceParams,
  TGetLegalContentServiceParams,
  TUpdateLegalContentServiceParams,
} from '@/app/modules/legal/legal.types';
import {
  computeSourceHash,
  invalidateStaleTranslations,
  preTranslateContent,
} from '@/app/services/translation/translation.service';
import { localizeLegalContent } from '@/app/services/translation/entityLocalizers';
import { TRANSLATION_CONFIG } from '@/const';

/**
 * Fetches published legal content by type for public / unauthenticated clients.
 * Localizes `content` to the active request locale (alua `localization` meta).
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

  const base = LegalContentDTO.build(row);
  const localized = await localizeLegalContent({
    id: row.id,
    content: base.content,
  });

  return new LegalContentDTO(
    row.id,
    row.legalContentType,
    localized.content,
    row.updatedAt,
    localized.localization
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

  const base = LegalContentDTO.build(row);
  const localized = await localizeLegalContent({
    id: row.id,
    content: base.content,
  });

  return new LegalContentDTO(
    row.id,
    row.legalContentType,
    localized.content,
    row.updatedAt,
    localized.localization
  );
};

/**
 * Creates or updates legal content (admin Publish).
 * Invalidates stale translations and pre-translates into enabled company languages.
 *
 * @param {TUpdateLegalContentServiceParams} params - Type and HTML/markdown body.
 * @returns {Promise<LegalContentDTO>} Upserted row with localization meta (source locale).
 */
export const updateLegalContentService = async ({
  type,
  content,
}: TUpdateLegalContentServiceParams): Promise<LegalContentDTO> => {
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

  const localized = await localizeLegalContent({
    id: legalContent.id,
    content: legalContent.content,
  });

  return new LegalContentDTO(
    legalContent.id,
    legalContent.legalContentType,
    localized.content,
    legalContent.updatedAt,
    localized.localization
  );
};
