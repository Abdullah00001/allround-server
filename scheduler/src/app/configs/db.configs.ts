import { PrismaClient } from '@prisma/client';

import logger from '@/app/configs/logger.configs';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e: any) =>
  logger.error(`[Prisma] ${e.message}`)
);
prisma.$on('warn', (e: any) =>
  logger.warn(`[Prisma] ${e.message}`)
);

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  console.log('[Database] Connected');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log('[Database] Disconnected');
};

export default prisma;
