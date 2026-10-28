export interface ExtendedError extends Error {
  cause?: {
    name?: string;
    message?: string;
    code?: string;
  };
  $metadata?: unknown;
}
