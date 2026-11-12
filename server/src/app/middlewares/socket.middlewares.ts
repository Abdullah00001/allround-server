import { UserStatus } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { AuthenticatedSocket } from '@/app/@types/jwt.types';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import {
  getTraceId,
  requestContext,
} from '@/app/configs/requestContext.configs';
import { getRedisClient } from '@/app/configs/redis.configs';
import {
  extractTokenFromSocketHeader,
  verifyAccessToken,
} from '@/app/utils/jwt.utils';
import { COOKIE_NAMES } from '@/const';

/**
 * Parses a raw Cookie header into a name→value map.
 *
 * @param {string | undefined} cookieHeader - Raw `Cookie` header value.
 * @returns {Record<string, string>} Parsed cookies.
 */
const parseCookieHeader = (
  cookieHeader: string | undefined
): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
};

/**
 * Resolves a JWT for socket auth from handshake auth/header or admin cookie.
 * Priority: `handshake.auth.token` / `Authorization` → `access_token` cookie.
 *
 * @param {AuthenticatedSocket} socket - Connecting socket.
 * @returns {string | null} Raw JWT string, or null when absent.
 */
const resolveSocketAccessToken = (
  socket: AuthenticatedSocket
): string | null => {
  const headerToken = extractTokenFromSocketHeader(socket);
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  const cookieToken = cookies[COOKIE_NAMES.ACCESS_TOKEN];
  return cookieToken || null;
};

/**
 * Seeds AsyncLocalStorage with a per-connection trace id for socket handlers.
 *
 * @param {AuthenticatedSocket} socket - Connecting socket.
 * @param {(err?: Error) => void} next - Socket.IO middleware continuation.
 * @returns {void}
 */
export const socketTraceMiddleware = (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  const traceIdFromHeader = socket.handshake.headers['x-trace-id'];
  const traceIdFromQuery = socket.handshake.query?.traceId;
  const traceId =
    typeof traceIdFromHeader === 'string'
      ? traceIdFromHeader
      : typeof traceIdFromQuery === 'string'
        ? traceIdFromQuery
        : Array.isArray(traceIdFromQuery)
          ? traceIdFromQuery[0]
          : uuidv4();

  socket.traceId = traceId;

  requestContext.run({ traceId }, () => {
    next();
  });
};

/**
 * Authenticates Socket.IO connections via mobile JWT bearer or admin session cookie.
 * Rejects blacklisted, expired, invalid, missing, or inactive-user tokens.
 *
 * @param {AuthenticatedSocket} socket - Connecting socket.
 * @param {(err?: Error) => void} next - Socket.IO middleware continuation.
 * @returns {Promise<void>}
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  try {
    const token = resolveSocketAccessToken(socket);
    if (!token) {
      logger.warn(`Socket auth failed — no token provided: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: No token provided'));
    }

    const redisClient = getRedisClient();
    const isBlackListed = await redisClient.get(`blacklist:jwt:${token}`);

    if (isBlackListed) {
      logger.warn(`Socket auth failed — Token blacklisted: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: Token blacklisted'));
    }

    const decoded = verifyAccessToken(token);
    if (decoded.error || !decoded.data) {
      logger.warn(`Socket auth failed — Invalid token: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: Invalid token provided'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.data.sub },
    });
    if (!user) {
      logger.warn(`Socket auth failed — user not found: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: User not found'));
    }
    if (user.status !== UserStatus.ACTIVE) {
      logger.warn(
        `Socket auth failed — user not active: ${socket.id} (status: ${user.status})`
      );
      return next(new Error('UNAUTHORIZED: User account is not active'));
    }

    socket.user = user;

    socket.use((_packet, nextPacket) => {
      const packetTraceId = socket.traceId ?? uuidv4();
      requestContext.run({ traceId: packetTraceId }, () => nextPacket());
    });

    logger.info(`Socket authenticated — userId: ${decoded.data.sub}`);
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      logger.warn(`Socket auth failed — token expired: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: Token expired'));
    }

    if (err instanceof JsonWebTokenError) {
      logger.warn(`Socket auth failed — invalid token: ${socket.id}`);
      return next(new Error('UNAUTHORIZED: Invalid token'));
    }

    logger.error(`Socket auth error: ${err}`);
    next(new Error('INTERNAL_ERROR: Authentication failed'));
  }
};

/**
 * Emits a structured socket error envelope and logs the failure.
 *
 * @param {Error} err - Error thrown by a socket handler.
 * @param {AuthenticatedSocket} socket - Socket that received the error.
 * @returns {void}
 */
export const globalSocketErrorMiddleware = (
  err: Error,
  socket: AuthenticatedSocket
) => {
  const traceId = getTraceId() || socket.traceId;
  if (err instanceof Error) {
    logger.error({
      traceId,
      message: err.message,
      stack: err.stack,
    });
    socket.emit('error', {
      success: false,
      message: err.message || 'Internal Server Error',
      traceId,
    });
    return;
  }
  logger.error({
    traceId,
    message: 'Unexpected Socket Error Occurred',
  });
  socket.emit('error', {
    success: false,
    message: 'Internal Server Error',
    traceId,
  });
};
