import { Queue } from 'bullmq';
import { createQueueOptions } from '@/app/configs/queue.configs';

let _translationQueue: Queue | null = null;

export const getTranslationQueue = (): Queue => {
  if (!_translationQueue) {
    _translationQueue = new Queue('translation-queue', createQueueOptions());
  }
  return _translationQueue;
};
