import { AsyncResource } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { requestContext } from '@/app/configs/requestContext.configs';

export const traceMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const traceId = uuidv4();

  requestContext.run({ traceId }, () => {
    res.setHeader('x-trace-id', traceId);
    AsyncResource.bind(next)();
  });
};
