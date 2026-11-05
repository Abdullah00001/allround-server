import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IResendOtp } from '@/app/queues/email/email.types';
import { companyInformation, QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import { mailOption } from '@/app/utils/system.utils';
import resendOtpTemplate from '@/app/templates/resendOtp.template';
import { compile } from 'handlebars';
import mailTransporter from '@/app/configs/nodemailer.config';

const handler: IJobHandler<IResendOtp> = {
  name: QUEUE_JOBS.RESEND_OTP,
  handler: async (data: IResendOtp, job: Job) => {
    // Write your processing logic here
    const { email, name, otp, otpExpiredAt, traceId } = data;
    try {
      const template = compile(resendOtpTemplate);
      const personalizedTemplate = template({
        name,
        email,
        otp,
        otpExpiredAt,
      });
      const mail = mailOption({
        to: email,
        subject: `Action Required: Your Verification Code - ${otp}`,
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
