import { Server } from 'node:http';

import { disconnectDatabase } from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { disconnectRedis } from '@/app/configs/redis.configs';

type TShutdown = {
  reason: string;
  server: Server;
  error?: unknown;
};

let isShuttingDown = false;

export const shutdown = async ({
  reason,
  server,
  error,
}: TShutdown): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Shutdown started: ${reason}`);

  if (error) {
    logger.error(error);
  }

  /**
   * Force exit after timeout (Docker / K8s safety)
   */
  const forceExitTimer = setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 30_000);

  try {
    /**
     * Stop accepting new connections
     */
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
    // Close DB, Redis, queues here
    await disconnectRedis();
    await disconnectDatabase();
  } catch (err) {
    logger.error('Error during shutdown', err);
  } finally {
    clearTimeout(forceExitTimer);

    /**
     * Exit code matters:
     * - 0 = graceful (SIGTERM, SIGINT)
     * - 1 = crash (exceptions)
     */
    const exitCode = reason === 'SIGINT' || reason === 'SIGTERM' ? 0 : 1;

    process.exit(exitCode);
  }
};
