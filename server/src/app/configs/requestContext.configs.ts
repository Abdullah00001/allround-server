import { AsyncLocalStorage } from 'async_hooks';

type RequestStore = {
  traceId: string;
  locale?: string;
  subscriptionCache?: Map<string, any>;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

/**
 * Returns the current request trace ID from AsyncLocalStorage.
 *
 * @returns {string} Trace ID, or `NO_TRACE_ID` when no store is active.
 */
export const getTraceId = (): string => {
  return requestContext.getStore()?.traceId ?? 'NO_TRACE_ID';
};

/**
 * Returns the active request locale from AsyncLocalStorage.
 *
 * @returns {string} Lowercase locale code (e.g. `de`), defaulting to `en`.
 */
export const getLocale = (): string => {
  return requestContext.getStore()?.locale ?? 'en';
};

/**
 * Updates the locale on the active AsyncLocalStorage store when one exists.
 *
 * @param {string} locale - Locale code to store (normalized by callers).
 * @returns {void}
 */
export const setLocale = (locale: string): void => {
  const store = requestContext.getStore();
  if (store) {
    store.locale = locale;
  }
};
