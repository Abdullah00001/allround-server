import fs from 'fs';
import path from 'path';
import { Worker } from 'bullmq';

import logger from '@/app/configs/logger.configs';

export const loadAllWorkers = (): Worker[] => {
  const workers: Worker[] = [];
  const queuesDir = __dirname;

  if (!fs.existsSync(queuesDir)) {
    return workers;
  }

  const entries = fs.readdirSync(queuesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const queueName = entry.name;
      // We look for a file named '<queueName>.workers.ts' or '<queueName>.workers.js'
      const workersFileTs = path.join(
        queuesDir,
        queueName,
        `${queueName}.workers.ts`
      );
      const workersFileJs = path.join(
        queuesDir,
        queueName,
        `${queueName}.workers.js`
      );

      const workersFile = fs.existsSync(workersFileTs)
        ? workersFileTs
        : fs.existsSync(workersFileJs)
          ? workersFileJs
          : null;

      if (workersFile) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const module = require(workersFile);

          // Find the exported function that starts with 'create' and ends with 'Worker'
          // e.g., createEmailWorker()
          const exportKeys = Object.keys(module);
          const workerFactoryKey = exportKeys.find(
            (key) => key.startsWith('create') && key.endsWith('Worker')
          );

          if (
            workerFactoryKey &&
            typeof module[workerFactoryKey] === 'function'
          ) {
            const workerInstance = module[workerFactoryKey]();
            if (workerInstance instanceof Worker) {
              workers.push(workerInstance);
              logger.info(
                `[Worker Registry] Loaded worker from module '${queueName}'`
              );
            }
          } else {
            logger.warn(
              `[Worker Registry] Could not find a valid worker factory function in '${workersFile}'`
            );
          }
        } catch (error) {
          console.error('[Worker Registry Raw Error]', error);
          logger.error(
            `[Worker Registry] Failed to load worker module '${queueName}'`,
            { error }
          );
        }
      }
    }
  }

  return workers;
};
