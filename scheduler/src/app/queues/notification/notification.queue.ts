import { Queue } from 'bullmq';
import { createQueueOptions } from '@/app/configs/queue.configs';

let _notificationQueue: Queue | null = null;

export const getNotificationQueue = (): Queue => {
  if (!_notificationQueue) {
    _notificationQueue = new Queue('notification-queue', createQueueOptions());
  }
  return _notificationQueue;
};
