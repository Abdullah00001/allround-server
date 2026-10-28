import { NextFunction, Request, Response } from 'express';

import logger from '@/app/configs/logger.configs';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { ExtendedError } from '@/app/@types/error.types';
import { SystemErrorType } from '@/const';

export const globalErrorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const traceId = getTraceId();
  if (err instanceof Error) {
    const e = err as ExtendedError;
    const causeObj = e.cause;
    const causeStr = causeObj ? ` | Cause: [${causeObj.name}] ${causeObj.message} (Code: ${causeObj.code})` : '';
    const metaStr = e.$metadata ? ` | $metadata: ${JSON.stringify(e.$metadata)}` : '';

    logger.error({
      traceId: traceId,
      message: `${err.name}: ${err.message}${causeStr}${metaStr}`,
      stack: err.stack,
    });

    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON Payload',
        errorType: SystemErrorType.INVALID_JSON_PAYLOAD,
        traceId: traceId,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      errorType: SystemErrorType.INTERNAL_SERVER_ERROR,
      traceId: traceId,
    });
    return;
  }

  logger.error({
    traceId,
    message: 'Unexpected Error Occurred In Somewhere',
  });

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    errorType: SystemErrorType.INTERNAL_SERVER_ERROR,
    traceId,
  });

  return;
};
