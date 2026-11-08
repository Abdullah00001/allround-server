import {
  calculateMilliseconds,
  createRedisKey,
  generate,
} from '@/app/utils/system.utils';
import {
  TFindRecoverUserByEmailServiceParams,
  TResendRecoverUserOtpServiceParams,
  TResetRecoverUserPasswordServiceParams,
  TVerifyRecoverUserOtpServiceParams,
} from '@/app/modules/recover/recover.types';
import { hashOtp } from '@/app/utils/otp.utils';
import {
  generateResetPasswordPageToken,
  verifyResetPasswordPageToken,
} from '@/app/utils/jwt.utils';
import { otpExpireAt, QUEUE_JOBS, REDIS_PREFIXES } from '@/const';
import { FindRecoverUserServiceDTO } from '@/app/modules/recover/recover.dto';
import { getRedisClient } from '@/app/configs/redis.configs';
import { getEmailQueue } from '@/app/queues/email/email.queue';
import prisma from '@/app/configs/db.configs';
import { hashPassword } from '@/app/utils/password.utils';

/**
 * Find recover user, store OTP, send email via RESEND_OTP, return page token.
 */
export const findRecoverUserService = async ({
  traceId,
  user,
}: TFindRecoverUserByEmailServiceParams): Promise<FindRecoverUserServiceDTO> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const otp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      specialChars: false,
      upperCaseAlphabets: false,
    });
    const hashedOtp = hashOtp({ otp });
    const token = generateResetPasswordPageToken({
      accountStatus: user.status,
      role: user.role,
      sub: user.id,
    });
    const emailPayload = {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      otp,
      otpExpireAt,
      traceId,
    };
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.otp, user.id.toString()),
        hashedOtp,
        'EX',
        calculateMilliseconds(otpExpireAt, 'minutes')
      ),
      emailQueue.add(QUEUE_JOBS.RESEND_OTP, emailPayload),
    ]);
    return FindRecoverUserServiceDTO.build({
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: user.avatarUrl,
      token,
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Resend recover OTP using RESEND_OTP job.
 */
export const resendRecoverUserOtpService = async ({
  traceId,
  user,
}: TResendRecoverUserOtpServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const otp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      specialChars: false,
      upperCaseAlphabets: false,
    });
    const hashedOtp = hashOtp({ otp });
    const emailPayload = {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      otp,
      otpExpireAt,
      traceId,
    };
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.otp, user.id.toString()),
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

/**
 * Clear OTP after successful verification middleware.
 */
export const verifyRecoverUserOtpService = async ({
  user,
}: TVerifyRecoverUserOtpServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    await redisClient.del(createRedisKey(REDIS_PREFIXES.otp, user.id));
    return;
  } catch (error) {
    throw error;
  }
};

/**
 * Reset password, blacklist page token, send confirmation email.
 */
export const resetRecoverUserPasswordService = async ({
  password,
  traceId,
  user,
  token,
}: TResetRecoverUserPasswordServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
      },
    });
    const emailPayload = {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      traceId,
    };
    const decoded = verifyResetPasswordPageToken(token);
    const tokenExpirationTime = decoded.data?.exp as number;
    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = Math.floor(tokenExpirationTime - currentTime);
    if (ttl > 0) {
      await redisClient.set(
        createRedisKey(REDIS_PREFIXES.blacklist, token),
        token,
        'EX',
        ttl
      );
    }
    await emailQueue.add(
      QUEUE_JOBS.RESET_RECOVER_USER_PASSWORD_SUCCESSFUL,
      emailPayload
    );
    return;
  } catch (error) {
    throw error;
  }
};

export const findAdminEmailForRecoverAccountService = async (
  params: TFindRecoverUserByEmailServiceParams
): Promise<FindRecoverUserServiceDTO> => {
  try {
    return await findRecoverUserService(params);
  } catch (error) {
    throw error;
  }
};

export const resendOtpToRecoverAdminEmailService = async (
  params: TResendRecoverUserOtpServiceParams
): Promise<void> => {
  try {
    await resendRecoverUserOtpService(params);
    return;
  } catch (error) {
    throw error;
  }
};

export const verifyRecoverAdminOtpService = async (
  params: TVerifyRecoverUserOtpServiceParams
): Promise<void> => {
  try {
    await verifyRecoverUserOtpService(params);
    return;
  } catch (error) {
    throw error;
  }
};

export const resetRecoverAdminPasswordService = async (
  params: TResetRecoverUserPasswordServiceParams
): Promise<void> => {
  try {
    await resetRecoverUserPasswordService(params);
    return;
  } catch (error) {
    throw error;
  }
};
