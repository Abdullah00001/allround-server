/**
 * BullMQ payload for PROCESS_TRANSLATION (matches server ITranslationJobPayload).
 */
export interface IProcessTranslation {
  /** Domain content type (e.g. LEGAL_CONTENT, NOTIFICATION). */
  contentType: string;
  /** Source entity UUID. */
  contentId: string;
  /** Source locale code (e.g. `de`, `en`). */
  sourceLocale: string;
  /** Target locale code. */
  targetLocale: string;
  /** SHA-256 of source fields at enqueue time. */
  sourceHash: string;
  /** Field map of source strings to translate. */
  fields: Record<string, string>;
}

/** @deprecated Alias kept for older imports. */
export type ITranslationJobPayload = IProcessTranslation;
