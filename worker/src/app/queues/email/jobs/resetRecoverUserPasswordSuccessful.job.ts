import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IResetRecoverUserPasswordSuccessful } from '@/app/queues/email/email.types';
import { companyInformation, QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import mailTransporter from '@/app/configs/nodemailer.config';
import { mailOption } from '@/app/utils/system.utils';
import { compile } from 'handlebars';
import resetRecoverUserPasswordSuccessfulTemplate from '@/app/templates/resetRecoverUserPasswordSuccessful.template';
import { getEmailSubject } from '@/app/i18n';

/**
 * Sends the password-reset confirmation email.
 */
const handler: IJobHandler<IResetRecoverUserPasswordSuccessful> = {
  name: QUEUE_JOBS.RESET_RECOVER_USER_PASSWORD_SUCCESSFUL,
  handler: async (data: IResetRecoverUserPasswordSuccessful, job: Job) => {
    const { email, name, traceId, language } = data;
    try {
      const template = compile(resetRecoverUserPasswordSuccessfulTemplate);
      const personalizedTemplate = template({
        name,
        email,
      });
      const mail = mailOption({
        to: email,
        subject: getEmailSubject('password.reset.subject', language),
        html: personalizedTemplate,
        replyTo: companyInformation.email,
      });
      await mailTransporter.sendMail(mail);
      return;
    } catch (error) {
      logger.error('Failed to send password reset success email:', {
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
