import { Job, Worker } from 'bullmq';
import fs from 'fs';
import path from 'path';

import logger from '@/app/configs/logger.configs';
import { getRedisClient } from '@/app/configs/redis.configs';
import { IJobHandler } from '@/app/@types/queue.types';

export const createTranslationWorker = (): Worker => {
  // Dynamically load all job handlers from the jobs/ directory
  const handlers: Record<string, IJobHandler> = {};
  const jobsDir = path.join(__dirname, 'jobs');

  if (fs.existsSync(jobsDir)) {
    const files = fs
      .readdirSync(jobsDir)
      .filter((f) => f.endsWith('.job.ts') || f.endsWith('.job.js'));
    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const importedModule = require(path.join(jobsDir, file));
      const jobHandler: IJobHandler = importedModule.default || importedModule;
      if (
        jobHandler &&
        jobHandler.name &&
        typeof jobHandler.handler === 'function'
      ) {
        handlers[jobHandler.name] = jobHandler;
        logger.info(
          `[Worker] Registered handler for job '${jobHandler.name}' in queue 'translation'`
        );
      }
    }
  }

  const worker = new Worker(
    'translation-queue',
    async (job: Job) => {
      const { name, data, id } = job;

      const jobHandler = handlers[name];
      if (!jobHandler) {
        throw new Error(`Unhandled job '${name}' in queue 'translation'`);
      }

      try {
        await jobHandler.handler(data, job);
      } catch (error) {
        logger.error(`[${job.name}] Job failed`, { jobId: id, error });
        throw error;
      }
    },
    {
      connection:
        getRedisClient() as unknown as import('bullmq').ConnectionOptions,
    }
  );

  worker.on('completed', (job: Job) => {
    logger.info(
      `[Worker] Job '${job.name}' (ID: ${job.id}) completed successfully in 'translation' queue.`
    );
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    if (job) {
      logger.error(
        `[Worker] Job '${job.name}' (ID: ${job.id}) failed in 'translation' queue.\n${error.stack}`
      );
    } else {
      logger.error(
        `[Worker] A job failed in 'translation' queue but job data is undefined.\n${error.stack}`
      );
    }
  });

  return worker;
};
