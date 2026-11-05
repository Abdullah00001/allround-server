import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IResendOtp } from '@/app/queues/email/email.types';
import { QUEUE_JOBS } from '@/const';

const handler: IJobHandler<IResendOtp> = {
  name: QUEUE_JOBS.RESEND_OTP,
  handler: async (data: IResendOtp, job: Job) => {
    // Write your processing logic here
    console.log(`Executing ${job.name} with data:`, data);
  },
};

export default handler;
