import { QueueOptions } from 'bullmq';

import { getRedisClient } from '@/app/configs/redis.configs';

export function createQueueOptions(): QueueOptions {
  return {
    connection:
      getRedisClient() as unknown as import('bullmq').ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}

// End of queue configs
