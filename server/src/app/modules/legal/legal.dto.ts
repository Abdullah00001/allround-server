import { LegalContent, LegalContentType } from '@prisma/client';

/**
 * Legal document DTO for public and admin responses.
 */
export class LegalContentDTO {
  /**
   * @param {LegalContentType} legalContentType - Document category.
   * @param {string} content - HTML/markdown body (rich-text from admin editor).
   * @param {Date | null} updatedAt - Last publish time; null when not yet created.
   */
  constructor(
    public legalContentType: LegalContentType,
    public content: string,
    public updatedAt: Date | null
  ) {}

  /**
   * Builds a DTO from a Prisma `LegalContent` row.
   *
   * @param {LegalContent} row - Persisted legal content.
   * @returns {LegalContentDTO} API-safe payload.
   */
  static build(row: LegalContent) {
    return new LegalContentDTO(
      row.legalContentType,
      row.content,
      row.updatedAt
    );
  }

  /**
   * Empty placeholder when admin opens a type that has never been published.
   *
   * @param {LegalContentType} type - Requested type.
   * @returns {LegalContentDTO} Empty content with null updatedAt.
   */
  static empty(type: LegalContentType) {
    return new LegalContentDTO(type, '', null);
  }
}
