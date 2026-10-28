import 'dotenv/config';

import logger from '@/app/configs/logger.configs';
import { connectDatabase, disconnectDatabase } from '@/app/configs/db.configs';
import { connectRedis, disconnectRedis } from '@/app/configs/redis.configs';

const TAG = '[Corn]';

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${TAG} ${signal} received — stopping schedules`);

  try {
    await disconnectRedis();
    logger.info(`${TAG} Redis disconnected`);

    await disconnectDatabase();
    logger.info(`${TAG} Database disconnected`);

    logger.info(`${TAG} ✓ Clean shutdown`);
    process.exit(0);
  } catch (err) {
    logger.error(`${TAG} Error during shutdown`, { err });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`${TAG} Uncaught exception`, { err });
});

process.on('unhandledRejection', (reason) => {
  logger.error(`${TAG} Unhandled rejection`, { reason });
});

const start = async (): Promise<void> => {
  logger.info(`${TAG} Starting — PID ${process.pid}`);

  await connectRedis();
  await connectDatabase();
  await import('@/app/jobs');
  logger.info(`${TAG} Ready — schedules loaded and running`);
};

start().catch((err) => {
  console.error('CORN STARTUP ERROR:', err);
  logger.error(`${TAG} Failed to start`, { err });
  process.exit(1);
});
