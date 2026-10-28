import { Server as HttpServer } from 'node:http';
import { Namespace, Server } from 'socket.io';

import { AuthenticatedSocket } from '@/app/@types/jwt.types';
import logger from '@/app/configs/logger.configs';
import {
  globalSocketErrorMiddleware,
  socketAuthMiddleware,
  socketTraceMiddleware,
} from '@/app/middlewares/socket.middlewares';
import { baseUrl, corsWhiteList } from '@/const';
import { chatNamespace, notificationNamespace } from '@/app/sockets/namespace';

export let io: Server;
export let chatNameSpace: Namespace;
export let notificationNameSpace: Namespace;

const initializeSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: corsWhiteList,
      methods: ['POST', 'GET'],
      credentials: true,
    },
  });

  // Root io middlewares & connection
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

  // Attach namespaces matching reference project: /api/v1/chat and /api/v1/notification
  chatNameSpace = io.of(`${baseUrl.v1}/chat`);
  notificationNameSpace = io.of(`${baseUrl.v1}/notification`);

  chatNameSpace.use(socketTraceMiddleware);
  chatNameSpace.use(socketAuthMiddleware);
  notificationNameSpace.use(socketTraceMiddleware);
  notificationNameSpace.use(socketAuthMiddleware);

  chatNamespace(chatNameSpace);
  notificationNamespace(notificationNameSpace);

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

export default initializeSocket;
