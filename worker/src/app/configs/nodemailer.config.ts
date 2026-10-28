import { type TransportOptions, createTransport } from 'nodemailer';

import { env } from '@/env';

const mailTransporter = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465 ? true : false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
} as TransportOptions);

export default mailTransporter;
