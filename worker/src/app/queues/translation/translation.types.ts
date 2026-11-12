/**
 * BullMQ payload for scaffolded Google Translate jobs.
 * Content CRM migration is out of scope; this keeps architecture parity.
 */
export interface IProcessTranslation {
  /** Opaque content type label for logging (e.g. LEGAL_CONTENT). */
  contentType: string;
  /** Source entity UUID for logging/correlation. */
  contentId: string;
  /** Source locale code (e.g. `en`, `de`). */
  sourceLocale: string;
  /** Target locale code. */
  targetLocale: string;
  /** Field map of source strings to translate. */
  fields: Record<string, string>;
}
