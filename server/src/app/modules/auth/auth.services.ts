import { generateOtpPageToken } from '@/app/utils/jwt.utils';
import { hashOtp } from '@/app/utils/otp.utils';
import { hashPassword } from '@/app/utils/password.utils';
import {
  calculateMilliseconds,
  createRedisKey,
  generate,
} from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import {
  TResendOtpServiceParams,
  TSignupServiceParams,
} from '@/app/modules/auth/auth.types';
import { getRedisClient } from '@/app/configs/redis.configs';
import { otpExpireAt, QUEUE_JOBS, REDIS_PREFIXES } from '@/const';
import { getEmailQueue } from '@/app/queues/email/email.queue';
import { SignupServiceDTO } from '@/app/modules/auth/auth.dto';

/**
 * Signup new user service
 * @param {TSignupServiceParams} payload
 * @returns {Promise<SignupServiceDTO>}
 */
export const signupService = async ({
  payload,
  traceId,
}: TSignupServiceParams): Promise<SignupServiceDTO> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const { email, firstName, lastName, password, role, phone } = payload;
    const plainOtp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const hashedPassword = await hashPassword(password);
    const hashedOtp = hashOtp({ otp: plainOtp });
    const emailPayload = {
      name: `${firstName} ${lastName}`,
      otp: plainOtp,
      otpExpireAt,
      traceId,
      email,
    };
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        passwordHash: hashedPassword,
        role,
      },
    });
    const otpPageToken = generateOtpPageToken({
      role: user.role,
      sub: user.id,
      accountStatus: user.status,
    });

    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.otp, user.id),
        hashedOtp,
        'EX',
        calculateMilliseconds(otpExpireAt, 'minutes')
      ),
      emailQueue.add(QUEUE_JOBS.ACCOUNT_CREATE_SUCCESS, emailPayload),
    ]);
    return SignupServiceDTO.build(
      `${firstName} ${lastName}`,
      email,
      role,
      otpPageToken
    );
  } catch (error) {
    throw error;
  }
};

export const resendOtpService = async ({
  user,
  traceId,
}: TResendOtpServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const name = `${user.firstName} ${user.lastName}`;
    const { email, id } = user;
    const plainOtp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const hashedOtp = hashOtp({ otp: plainOtp });
    const emailPayload = {
      name,
      otp: plainOtp,
      otpExpireAt,
      traceId,
      email,
    };
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.otp, id),
        hashedOtp,
        'EX',
        calculateMilliseconds(otpExpireAt, 'minutes')
      ),
      emailQueue.add(QUEUE_JOBS.RESEND_OTP, emailPayload),
    ]);
    return;
  } catch (error) {
    throw error;
  }
};
