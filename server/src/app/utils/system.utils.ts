import { AsyncResource } from 'async_hooks';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { ZodType } from 'zod';
import crypto from 'crypto';

import logger from '@/app/configs/logger.configs';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { unlink } from 'fs/promises';
import { OTPOptions, TRedisPrefix } from '@/app/@types/system.types';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Wraps an async Express route handler and forwards
 * any thrown error or rejected promise to `next()`.
 *
 * This enables centralized error handling and avoids
 * repetitive try/catch blocks in controllers.
 *
 * @example
 * router.get(
 *   '/users',
 *   asyncHandler(controller.getUsers)
 * );
 */
export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(AsyncResource.bind(handler)(req, res, next)).catch(next);
  };

export function calculateMilliseconds(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'millisecond':
    case 'milliseconds':
      return value;
    case 'second':
    case 'seconds':
      return value * 1000;
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    default:
      return NaN;
  }
}

export function stringToNumber(value: string): number {
  return Number(value.slice(0, -1));
}

export function expiresInTimeUnitToMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) throw new Error('Invalid expiresIn format');

  const value = Number(match[1]);
  const unit = match[2];

  const map: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * map[unit];
}

export function formatDate(isoDateString: string): string {
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) throw new Error('Invalid date string');

  return dayjs(date).format('D MMMM YYYY');
}

export function formatDateTime(
  isoString: string,
  timeZone = 'Asia/Dhaka'
): string {
  return dayjs(isoString).tz(timeZone).format('MMMM D, YYYY [at] hh:mm A (z)');
}

export function calculateFutureDate(duration: string): string {
  const ms = expiresInTimeUnitToMs(duration);
  return new Date(Date.now() + ms).toISOString();
}

export function compareDate(oldDate: Date, duration: string): boolean {
  const ms = expiresInTimeUnitToMs(duration);
  return Date.now() - new Date(oldDate).getTime() >= ms;
}

export function generateEtag(data: unknown): string {
  try {
    const dataString = JSON.stringify(data);
    return crypto.createHash('md5').update(dataString).digest('hex');
  } catch (error) {
    throw new Error(
      `Failed to generate ETag: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const ALLOWED_WRITE_METHODS = ['POST', 'PUT', 'PATCH'] as const;

export const validateReqBody =
  <T>(schema: ZodType<T>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const traceId = getTraceId();
    if (!ALLOWED_WRITE_METHODS.includes(req.method as any)) {
      return next();
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      res.status(422).json({
        success: false,
        message: 'Request body validation failed',
        errors,
        traceId,
      });
      return;
    }
    req.body = result.data;

    next();
  };

const ALLOWED_METHODS = ['GET'] as const;

export const validateReqQuery =
  <T>(schema: ZodType<T>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (
        !ALLOWED_METHODS.includes(
          req.method as (typeof ALLOWED_METHODS)[number]
        )
      ) {
        return next();
      }

      // Convert null prototype object to regular object
      const queryObj = { ...req.query };
      const result = schema.safeParse(queryObj);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'query',
          message: issue.message,
        }));
        res.status(422).json({
          success: false,
          message: 'Request query validation failed',
          errors,
        });
        return;
      }
      // Assign validated data to req.query
      req.validatedQuery = result.data;
      next();
    } catch (error) {
      logger.error('CAUGHT ERROR in validateReqQuery middleware:', error);
      logger.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      );
      next(error);
    }
  };

export const validateReqParams =
  <T>(schema: ZodType<T>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'params',
          message: issue.message,
        }));
        res.status(422).json({
          success: false,
          message: 'Request params validation failed',
          errors,
        });
        return;
      }

      req.params = result.data as Record<string, string>;
      next();
    } catch (error) {
      logger.error('CAUGHT ERROR in validateReqParams middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during param validation',
      });
    }
  };

export function extractS3KeyFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Return the pathname without the leading slash to get the exact S3 object key
    // This safely works for both old AWS URLs and new DO Spaces URLs
    return parsedUrl.pathname.substring(1);
  } catch (error) {
    // Fallback if the URL is invalid or malformed
    return url;
  }
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export const validateSocketPayload = <T>(
  data: T,
  schema: ZodType<T>
): { data: T; error: null } | { data: null; error: unknown } => {
  try {
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'data',
        message: issue.message,
      }));

      return { data: null, error: { errors } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    logger.error('CAUGHT ERROR in validateSocketPayload utility:', error);
    logger.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack'
    );
    return {
      data: null,
      error: { errors: [{ field: 'unknown', message: 'Unknown error' }] },
    };
  }
};

export async function unlinkFile({
  filePath,
}: {
  filePath: string;
}): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred In File Unlink Utility');
  }
}

/**
 * Generates a cryptographically secure random OTP string.
 *
 * @param length - Desired length of the OTP (positive integer).
 * @param options - Character-set options.
 * @returns The generated OTP string.
 * @throws {Error} If length is invalid or no character set is selected.
 */
export function generate(length: number, options: OTPOptions): string {
  // Validate length
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('Length must be a positive integer.');
  }

  // Build the character pool
  const digitChars = '0123456789';
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let pool = '';
  if (options.digits) pool += digitChars;
  if (options.lowerCaseAlphabets) pool += lowerChars;
  if (options.upperCaseAlphabets) pool += upperChars;
  if (options.specialChars) pool += specialChars;

  if (pool.length === 0) {
    throw new Error('At least one character set must be enabled.');
  }

  // Use Web Crypto API (available in browsers and Node.js 15+)
  // In Node.js, you may need to use `globalThis.crypto` or `require('crypto').webcrypto`
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  const poolSize = pool.length;
  let otp = '';
  for (let i = 0; i < length; i++) {
    const index = randomValues[i] % poolSize;
    otp += pool[index];
  }

  return otp;
}

/**
 * Safely constructs a standardized, colon-separated Redis key.
 * * This utility acts as a defensive barrier against common runtime bugs by sanitizing
 * dynamic inputs, trimming accidental whitespace, and completely preventing
 * "undefined" or "null" strings from leaking into your database keys.
 *
 * @param prefix - The base namespace prefix from `REDIS_PREFIXES` (must not contain a trailing colon).
 * @param parts - Variadic list of dynamic identifiers (IDs, tokens, slugs) to append to the key.
 * * @returns A fully sanitized, colon-separated Redis key string (e.g., "user:otp:12345").
 * * @throws {Error} If any argument in `parts` resolves to `undefined`, `null`, or an empty string `""`.
 * * @example
 * // 1. Standard dynamic key generation
 * createRedisKey(REDIS_PREFIXES.otp, 12345);
 * // Returns: "user:otp:12345"
 * * @example
 * // 2. Multi-part key generation
 * createRedisKey(REDIS_PREFIXES.session, 'US', 'auth_token_xyz');
 * // Returns: "user:session:US:auth_token_xyz"
 * * @example
 * // 3. Edge Case: Throws error instead of creating a corrupt key like "user:otp:undefined"
 * const userId = undefined;
 * createRedisKey(REDIS_PREFIXES.otp, userId);
 * // Throws: [RedisKeyError] Invalid key component passed for prefix "user:otp". Received: undefined
 */
export function createRedisKey(
  prefix: TRedisPrefix,
  ...parts: (string | number)[]
): string {
  // Edge Case 1: Prevent empty, null, or undefined variables from turning into strings like "user:otp:undefined"
  const validParts = parts.map((part) => {
    if (part === undefined || part === null || part === '') {
      throw new Error(
        `[RedisKeyError] Invalid key component passed for prefix "${prefix}". Received: ${part}`
      );
    }
    return String(part).trim();
  });

  // Edge Case 2 & 3: Sanitize slashes/spaces and join cleanly with a single colon
  const joinedParts = validParts.join(':');

  return joinedParts ? `${prefix}:${joinedParts}` : prefix;
}

/**
 * Calculates the expiration time for a session based on a duration string.
 *
 * @param duration - The duration for which the session should be valid.
 * @returns The expiration time as a `Date` object.
 */
export const sessionTimeCalculation = (duration: string) => {
  const timeInMs = expiresInTimeUnitToMs(duration);
  return new Date(Date.now() + timeInMs);
};
