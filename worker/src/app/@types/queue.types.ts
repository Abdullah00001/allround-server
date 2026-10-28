import { Job } from 'bullmq';

/**
 * Interface for individual job handlers inside a queue.
 */
export interface IJobHandler<T = unknown> {
  name: string;
  handler: (data: T, job: Job) => Promise<void>;
}
