import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { ISignupUserVerificationSuccessful } from '@/app/queues/email/email.types';
import { companyInformation, QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import mailTransporter from '@/app/configs/nodemailer.config';
import { mailOption } from '@/app/utils/system.utils';
import { compile } from 'handlebars';
import signupUserVerificationSuccessfulTemplate from '@/app/templates/signupUserVerificationSuccessful.template';

const handler: IJobHandler<ISignupUserVerificationSuccessful> = {
  name: QUEUE_JOBS.SIGNUP_USER_VERIFICATION_SUCCESSFUL,
  handler: async (data: ISignupUserVerificationSuccessful, job: Job) => {
    // Write your processing logic here
    const { email, name, traceId } = data;
    try {
      const template = compile(signupUserVerificationSuccessfulTemplate);
      const personalizedTemplate = template({
        name,
        email,
        traceId,
      });
      const mail = mailOption({
        to: email,
        subject: `Your email address has been verified successfully.`,
        html: personalizedTemplate,
        replyTo: companyInformation.email,
      });
      await mailTransporter.sendMail(mail);
      return;
    } catch (error) {
      logger.error('Failed to send resend otp email:', {
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
