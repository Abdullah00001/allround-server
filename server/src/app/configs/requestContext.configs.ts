import { AsyncLocalStorage } from 'async_hooks';

type RequestStore = {
  traceId: string;
  subscriptionCache?: Map<string, any>;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

export const getTraceId = (): string => {
  return requestContext.getStore()?.traceId ?? 'NO_TRACE_ID';
};
