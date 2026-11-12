import { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Namespace, Server } from 'socket.io';

import { AuthenticatedSocket } from '@/app/@types/jwt.types';
import logger from '@/app/configs/logger.configs';
import { connectSocketRedisClients } from '@/app/configs/socketRedis.configs';
import {
  globalSocketErrorMiddleware,
  socketAuthMiddleware,
  socketTraceMiddleware,
} from '@/app/middlewares/socket.middlewares';
import { baseUrl, corsWhiteList } from '@/const';
import { notificationNamespace } from '@/app/sockets/namespace';

export let io: Server;
export let notificationNameSpace: Namespace;

/**
 * Initializes Socket.IO on the HTTP server with Redis adapter, auth, and namespaces.
 * Clients join personal rooms `user:{userId}` for targeted notification delivery.
 *
 * @param {HttpServer} server - Node HTTP server instance.
 * @returns {Promise<Server>} Configured Socket.IO server.
 */
const initializeSocket = async (server: HttpServer): Promise<Server> => {
  io = new Server(server, {
    cors: {
      origin: corsWhiteList,
      methods: ['POST', 'GET'],
      credentials: true,
    },
  });

  const { pubClient, subClient } = await connectSocketRedisClients();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('[Socket] Redis adapter attached');

  io.use(socketTraceMiddleware);
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const s = socket as AuthenticatedSocket;
    const userId = s.user?.id;
    logger.info(`Socket Connected: ${s.id} | userId: ${userId}`);

    if (userId) {
      s.join(`user:${userId}`);
      logger.info(`Socket ${s.id} joined personal room: user:${userId}`);
    }

    s.on('error', (err) => {
      globalSocketErrorMiddleware(err, s);
    });

    s.on('disconnect', (reason) => {
      logger.info(`Socket Disconnected: ${s.id} | reason: ${reason}`);
    });
  });

  notificationNameSpace = io.of(`${baseUrl.v1}/notification`);
  notificationNameSpace.use(socketTraceMiddleware);
  notificationNameSpace.use(socketAuthMiddleware);
  notificationNamespace(notificationNameSpace);

  return io;
};

/**
 * Returns the initialized Socket.IO server singleton.
 *
 * @returns {Server} Active Socket.IO server.
 * @throws {Error} When called before `initializeSocket`.
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

/**
 * Returns the notification namespace used for real-time notification events.
 *
 * @returns {Namespace} Notification Socket.IO namespace.
 * @throws {Error} When called before `initializeSocket`.
 */
export const getNotificationNameSpace = (): Namespace => {
  if (!notificationNameSpace) {
    throw new Error('Notification namespace has not been initialized');
  }
  return notificationNameSpace;
};

export default initializeSocket;
