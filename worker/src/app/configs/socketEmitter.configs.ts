import { Redis } from 'ioredis';
import { Emitter } from '@socket.io/redis-emitter';

import { env } from '@/env';
import { baseUrl } from '@/const';

let redisClient: Redis | null = null;
let emitter: Emitter | null = null;

/**
 * Builds an ioredis client for the Socket.IO Redis emitter.
 *
 * @returns {Redis} Lazy-connect Redis client.
 */
const createEmitterRedisClient = (): Redis => {
  return new Redis({
    host: env.REDIS_HOST,
    password: env.REDIS_PASSWORD,
    port: env.REDIS_PORT || 6379,
    tls: env.NODE_ENV === 'production' ? {} : undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
};

/**
 * Connects the Redis client used by `@socket.io/redis-emitter`.
 * Shares the same Redis pub/sub channel protocol as the API server adapter.
 *
 * @returns {Promise<Emitter>} Connected Socket.IO Redis emitter.
 */
export const connectSocketEmitter = async (): Promise<Emitter> => {
  if (emitter) {
    return emitter;
  }

  redisClient = createEmitterRedisClient();
  redisClient.on('error', (err) => {
    console.error('[SocketEmitter] Redis error:', err);
  });
  await redisClient.connect();
  emitter = new Emitter(redisClient);
  console.info('[SocketEmitter] Connected');
  return emitter;
};

/**
 * Returns the shared Socket.IO Redis emitter.
 *
 * @returns {Emitter} Active emitter instance.
 * @throws {Error} When called before `connectSocketEmitter`.
 */
export const getSocketEmitter = (): Emitter => {
  if (!emitter) {
    throw new Error(
      'Socket emitter not initialized. Call connectSocketEmitter() first.'
    );
  }
  return emitter;
};

/**
 * Emits a notification event to a user's personal room on the notification namespace.
 *
 * @param {string} userId - Target user UUID.
 * @param {string} eventName - Socket event name (e.g. `notification:new`).
 * @param {unknown} payload - Event payload.
 * @returns {void}
 */
export const emitToUserNotificationRoom = (
  userId: string,
  eventName: string,
  payload: unknown
): void => {
  const io = getSocketEmitter();
  io.of(`${baseUrl.v1}/notification`)
    .to(`user:${userId}`)
    .emit(eventName, payload);
};

/**
 * Disconnects the Socket.IO Redis emitter client.
 *
 * @returns {Promise<void>}
 */
export const disconnectSocketEmitter = async (): Promise<void> => {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.quit();
    console.info('[SocketEmitter] Disconnected');
  }
  redisClient = null;
  emitter = null;
};
