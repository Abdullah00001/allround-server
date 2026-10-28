import { TFirebaseCredentials } from '@/app/@types/system.types';
import { env } from '@/env';
import { SendMailOptions } from 'nodemailer';
import { unlink } from 'fs/promises';

export function mailOption({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  attachments,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: SendMailOptions['attachments'];
}): SendMailOptions {
  return {
    // aula360academia.com
    from: '"AULA360 ACADEMY" <no-reply@aula360academia.com>',
    to,
    subject,
    html,
    ...(text && { text }),
    ...(cc && { cc }),
    ...(bcc && { bcc }),
    ...(replyTo && { replyTo }),
    ...(attachments && { attachments }),
  };
}

export function getFirebaseCredentials(): TFirebaseCredentials {
  return {
    type: env.FIREBASE_ACCOUNT_TYPE,
    project_id: env.FIREBASE_PROJECT_ID,
    private_key_id: env.FIREBASE_PRIVATE_KEY_ID,
    private_key: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Handle escaped newlines
    client_id: env.FIREBASE_CLIENT_ID,
    auth_uri: env.FIREBASE_AUTH_URI,
    token_uri: env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: env.FIREBASE_UNIVERSE_DOMAIN,
    client_email: env.FIREBASE_CLIENT_EMAIL,
  };
}

export async function unlinkFile({
  filePath,
}: {
  filePath: string;
}): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}
