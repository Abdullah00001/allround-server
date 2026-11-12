import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import logger from '@/app/configs/logger.configs';
import { ICronJob } from '@/app/@types/job.types';

const TAG = '[Scheduler]';
const TIMEZONE = 'Europe/Berlin';

/**
 * Dynamically discovers task modules (.tasks.ts / .tasks.js) under each
 * jobs subdirectory, registers them with node-cron using Europe/Berlin
 * timezone, and logs successful registrations.
 *
 * @returns {void}
 */
const loadAndRegisterCronJobs = (): void => {
  const jobsRoot = __dirname;
  if (!fs.existsSync(jobsRoot)) {
    logger.warn(`${TAG} Jobs directory missing: ${jobsRoot}`);
    return;
  }

  const entries = fs.readdirSync(jobsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const moduleDir = path.join(jobsRoot, entry.name);
    const taskFiles = fs
      .readdirSync(moduleDir)
      .filter(
        (file) => file.endsWith('.tasks.ts') || file.endsWith('.tasks.js')
      );

    for (const file of taskFiles) {
      const modulePath = path.join(moduleDir, file);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const imported = require(modulePath);
      const job: ICronJob | undefined = imported.default || imported;

      if (!job?.name || !job.schedule || typeof job.execute !== 'function') {
        logger.warn(`${TAG} Skipping invalid cron module ${modulePath}`);
        continue;
      }

      if (!cron.validate(job.schedule)) {
        logger.error(
          `${TAG} Invalid cron expression for ${job.name}: ${job.schedule}`
        );
        continue;
      }

      cron.schedule(
        job.schedule,
        async () => {
          try {
            logger.info(`${TAG} Running job ${job.name}`);
            await job.execute();
          } catch (error) {
            logger.error(`${TAG} Job ${job.name} failed`, { error });
          }
        },
        { timezone: TIMEZONE }
      );

      logger.info(
        `${TAG} Registered job '${job.name}' (${job.schedule}, ${TIMEZONE})`
      );
    }
  }
};

loadAndRegisterCronJobs();
