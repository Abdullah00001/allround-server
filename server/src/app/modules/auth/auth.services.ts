import {
  generateAccessTokenForUser,
  generateOtpPageToken,
  verifyOtpPageToken,
} from '@/app/utils/jwt.utils';
import { hashOtp } from '@/app/utils/otp.utils';
import { hashPassword } from '@/app/utils/password.utils';
import {
  calculateMilliseconds,
  createRedisKey,
  generate,
  sessionTimeCalculation,
} from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { TSignupServiceParams } from '@/app/modules/auth/auth.types';
import { getRedisClient } from '@/app/configs/redis.configs';
import { otpExpireAt } from '@/const';

/**
 * Signup new user service
 * @param {TSignupServiceParams} payload
 * @returns {Promise<void>}
 */
export const signupService = async ({
  payload,
  traceId,
}: TSignupServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
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
    
    return;
  } catch (error) {
    throw error;
  }
};
