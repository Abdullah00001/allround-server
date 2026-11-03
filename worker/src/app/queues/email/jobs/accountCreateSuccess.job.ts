import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IAccountCreateSuccess } from '@/app/queues/email/email.types';
import { companyInformation, QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import { compile } from 'handlebars';
import accountCreateSuccessEmailTemplate from '@/app/templates/accountCreateSuccessEmail.template';
import { mailOption } from '@/app/utils/system.utils';
import mailTransporter from '@/app/configs/nodemailer.config';

const handler: IJobHandler<IAccountCreateSuccess> = {
  name: QUEUE_JOBS.ACCOUNT_CREATE_SUCCESS,
  handler: async (data: IAccountCreateSuccess, job: Job) => {
    // Write your processing logic here
    const { email, name, otp, otpExpiredAt, traceId } = data;
    try {
      const template = compile(accountCreateSuccessEmailTemplate);
      const personalizedTemplate = template({
        name,
        email,
        otp,
        otpExpiredAt,
      });
      const mail = mailOption({
        to: email,
        subject: `Welcome to ${companyInformation.name}. Please verify your email.`,
        html: personalizedTemplate,
        replyTo: companyInformation.email,
      });
      await mailTransporter.sendMail(mail);
      return;
    } catch (error) {
      logger.error('Failed to send account create success email:', {
        data,
        jobId: job.id,
        error,
        traceId,
      });
      throw error;
    }
  },
};

export default handler;
