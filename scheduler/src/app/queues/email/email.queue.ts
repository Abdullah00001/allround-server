import { Queue } from 'bullmq';
import { createQueueOptions } from '@/app/configs/queue.configs';

let _emailQueue: Queue | null = null;

export const getEmailQueue = (): Queue => {
  if (!_emailQueue) {
    _emailQueue = new Queue('email-queue', createQueueOptions());
  }
  return _emailQueue;
};
