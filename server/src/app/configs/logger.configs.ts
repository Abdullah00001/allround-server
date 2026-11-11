import { createLogger, format, transports } from 'winston';

import { getTraceId } from '@/app/configs/requestContext.configs';

const { printf, timestamp, combine, json, colorize, errors } = format;

const loggerFormat = printf(({ timestamp, message, level, stack }) => {
  const traceId = getTraceId();
  const base = `${timestamp} [traceId: ${traceId}] ${level} ${message}`;
  return stack ? `${base}\n${stack}` : base;
});

const logger = createLogger({
  level: 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    loggerFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/combine.log',
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
    new transports.File({
      level: 'info',
      filename: 'logs/info.log',
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
    new transports.File({
      level: 'error',
      filename: 'logs/error.log',
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
  ],
});

export default logger;
