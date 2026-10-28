import crypto from 'crypto';

import { THashOtpArgs, TCompareOtpArgs } from '@/app/@types/otp.types';
import { env } from '@/env';

const secret = env.OTP_HASH_SECRET;
/**
 * Hashes a plain OTP using HMAC-SHA256.
 */
export function hashOtp({ otp }: THashOtpArgs): string {
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
}

/**
 * Timing-safe OTP comparison
 */
export function compareOtp({ hashedOtp, otp }: TCompareOtpArgs): boolean {
  const inputHashedOtp = hashOtp({ otp });

  const stored = Buffer.from(hashedOtp, 'hex');
  const incoming = Buffer.from(inputHashedOtp, 'hex');

  if (stored.length !== incoming.length) return false;

  return crypto.timingSafeEqual(stored, incoming);
}
