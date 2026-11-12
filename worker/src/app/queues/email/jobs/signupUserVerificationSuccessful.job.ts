import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { ISignupUserVerificationSuccessful } from '@/app/queues/email/email.types';
import { companyInformation, QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import mailTransporter from '@/app/configs/nodemailer.config';
import { mailOption } from '@/app/utils/system.utils';
import { compile } from 'handlebars';
import signupUserVerificationSuccessfulTemplate from '@/app/templates/signupUserVerificationSuccessful.template';
import { getEmailSubject } from '@/app/i18n';

/**
 * Sends the post-verification welcome confirmation email.
 */
const handler: IJobHandler<ISignupUserVerificationSuccessful> = {
  name: QUEUE_JOBS.SIGNUP_USER_VERIFICATION_SUCCESSFUL,
  handler: async (data: ISignupUserVerificationSuccessful, job: Job) => {
    const { email, name, traceId, language } = data;
    try {
      const template = compile(signupUserVerificationSuccessfulTemplate);
      const personalizedTemplate = template({
        name,
        email,
        traceId,
      });
      const mail = mailOption({
        to: email,
        subject: getEmailSubject('welcome.subject', language),
        html: personalizedTemplate,
        replyTo: companyInformation.email,
      });
      await mailTransporter.sendMail(mail);
      return;
    } catch (error) {
      logger.error('Failed to send signup verification success email:', {
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
