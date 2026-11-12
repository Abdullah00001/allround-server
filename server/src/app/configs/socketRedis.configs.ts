import { Redis } from 'ioredis';

import { env } from '@/env';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

/**
 * Builds an ioredis client for the Socket.IO Redis adapter.
 *
 * @returns {Redis} Connected-ready (lazy) Redis client.
 */
const createSocketRedisClient = (): Redis => {
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
 * Connects the Socket.IO Redis pub/sub client pair (ioredis).
 * Safe to call multiple times; subsequent calls reuse existing clients.
 *
 * @returns {Promise<{ pubClient: Redis; subClient: Redis }>}
 */
export const connectSocketRedisClients = async (): Promise<{
  pubClient: Redis;
  subClient: Redis;
}> => {
  if (!pubClient) {
    pubClient = createSocketRedisClient();
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      console.error('[SocketRedis] Pub client error:', err);
    });
    subClient.on('error', (err) => {
      console.error('[SocketRedis] Sub client error:', err);
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.info('[SocketRedis] Pub/sub clients connected');
  }

  return {
    pubClient,
    subClient: subClient as Redis,
  };
};

/**
 * Gracefully disconnects the Socket.IO Redis pub/sub clients.
 *
 * @returns {Promise<void>}
 */
export const disconnectSocketRedisClients = async (): Promise<void> => {
  const closing: Promise<unknown>[] = [];
  if (pubClient && pubClient.status === 'ready') {
    closing.push(pubClient.quit());
  }
  if (subClient && subClient.status === 'ready') {
    closing.push(subClient.quit());
  }
  if (closing.length > 0) {
    await Promise.all(closing);
    console.info('[SocketRedis] Pub/sub clients disconnected');
  }
  pubClient = null;
  subClient = null;
};
