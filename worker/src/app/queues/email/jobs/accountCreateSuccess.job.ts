import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IAccountCreateSuccess } from '@/app/queues/email/email.types';
import { QUEUE_JOBS } from '@/const';

const handler: IJobHandler<IAccountCreateSuccess> = {
  name: QUEUE_JOBS.ACCOUNT_CREATE_SUCCESS,
  handler: async (data: IAccountCreateSuccess, job: Job) => {
    // Write your processing logic here
    console.log(`Executing ${job.name} with data:`, data);
  },
};

export default handler;
