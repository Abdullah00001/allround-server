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
import {
  TCheckAccessTokenServiceParams,
  TLoginServiceParams,
  TResendOtpServiceParams,
  TSignupServiceParams,
  TVerifySignupServiceParams,
} from '@/app/modules/auth/auth.types';
import { getRedisClient } from '@/app/configs/redis.configs';
import {
  locationExpireAt,
  otpExpireAt,
  QUEUE_JOBS,
  REDIS_PREFIXES,
  userAccessTokenExpiresIn,
} from '@/const';
import { getEmailQueue } from '@/app/queues/email/email.queue';
import {
  SignupServiceDTO,
  VerifySignupUserDTO,
} from '@/app/modules/auth/auth.dto';
import {
  DeviceStatus,
  Platform,
  RevokeReason,
  UserStatus,
} from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';

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

export const verifySignupUserControllerService = async ({
  payload,
  traceId,
  token,
  user,
}: TVerifySignupServiceParams): Promise<VerifySignupUserDTO> => {
  try {
    const redisClient = getRedisClient();
    const emailQueue = getEmailQueue();
    const { deviceIdentifier, lat, lng, otp, platform, fcmToken } = payload;
    const sessionExpiresAt = sessionTimeCalculation(userAccessTokenExpiresIn);
    const { updatedUser, device } = await prisma.$transaction(async (tx) => {
      // 1. Revoke any ACTIVE session with the same deviceIdentifier (different user)
      await tx.device.updateMany({
        where: {
          deviceIdentifier,
          status: DeviceStatus.ACTIVE,
        },
        data: {
          status: DeviceStatus.REVOKED,
          revokeReason: RevokeReason.NEW_LOGIN_SUPERSEDED,
          fcmToken: null,
        },
      });

      // 2. Revoke any ACTIVE session with the same fcmToken (different deviceIdentifier)
      if (fcmToken) {
        await tx.device.updateMany({
          where: {
            fcmToken,
            deviceIdentifier: { not: deviceIdentifier },
            status: DeviceStatus.ACTIVE,
          },
          data: {
            status: DeviceStatus.REVOKED,
            revokeReason: RevokeReason.FCM_SUPERSEDED,
            fcmToken: null,
          },
        });
      }

      // 3. Update user — mark verified + profile completed
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: user.email ? new Date() : undefined,
          phoneVerifiedAt: user.phone ? new Date() : undefined,
          lastLoginAt: new Date(),
        },
      });

      // 4. Create new device session
      const device = await tx.device.create({
        data: {
          userId: user.id,
          deviceIdentifier,
          fcmToken: fcmToken ?? null,
          platform: platform as Platform,
          status: DeviceStatus.ACTIVE,
          sessionExpiresAt,
        },
      });

      return { updatedUser, device };
    });
    const accessToken = generateAccessTokenForUser({
      role: updatedUser.role,
      sub: updatedUser.id,
      deviceId: device.id,
      accountStatus: updatedUser.status,
      rememberMe: true,
    });

    const decoded = verifyOtpPageToken(token) as JwtPayload;
    const tokenExpirationTime = decoded.exp as number;
    const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
    const ttl = Math.floor(tokenExpirationTime - currentTime); // remaining time in seconds
    if (ttl > 0)
      await redisClient.set(
        createRedisKey(REDIS_PREFIXES.blacklist, token),
        token as string,
        'EX',
        ttl
      );
    const emailPayload = {
      email: updatedUser.email,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      traceId,
    };
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.location, updatedUser.id),
        JSON.stringify({ lat, lng }),
        'EX',
        calculateMilliseconds(locationExpireAt, 'days')
      ),
      redisClient.geoadd(
        createRedisKey(REDIS_PREFIXES.locations),
        lng,
        lat,
        updatedUser.id
      ),
      emailQueue.add(
        QUEUE_JOBS.SIGNUP_USER_VERIFICATION_SUCCESSFUL,
        emailPayload
      ),
    ]);
    return VerifySignupUserDTO.build(accessToken, updatedUser);
  } catch (error) {
    throw error;
  }
};

export const checkUserAccessTokenService = async ({
  payload,
  user,
  device,
}: TCheckAccessTokenServiceParams): Promise<void> => {
  try {
    const { lat, lng, fcmToken } = payload;
    const redisClient = getRedisClient();
    const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;
    const shouldUpdateLastSeenAt =
      Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
    const shouldUpdateFcmToken = !!fcmToken && fcmToken !== device.fcmToken;

    if (shouldUpdateLastSeenAt || shouldUpdateFcmToken) {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: shouldUpdateLastSeenAt ? new Date() : undefined,
          fcmToken: shouldUpdateFcmToken ? fcmToken : undefined,
        },
      });
    }
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.location, user.id),
        JSON.stringify({ lat, lng }),
        'EX',
        calculateMilliseconds(locationExpireAt, 'days')
      ),
      redisClient.geoadd(
        createRedisKey(REDIS_PREFIXES.locations),
        lng,
        lat,
        user.id
      ),
    ]);
    return;
  } catch (error) {
    throw error;
  }
};

export const loginService = async ({
  payload,
  user,
}: TLoginServiceParams): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const { deviceIdentifier, fcmToken, platform, rememberMe, lat, lng } =
      payload;
    const sessionDuration = rememberMe ? '30d' : '7d';
    const sessionExpiresAt = sessionTimeCalculation(sessionDuration);

    const { updatedUser, device } = await prisma.$transaction(async (tx) => {
      // 1. Revoke any ACTIVE session with the same deviceIdentifier
      await tx.device.updateMany({
        where: {
          deviceIdentifier,
          status: DeviceStatus.ACTIVE,
        },
        data: {
          status: DeviceStatus.REVOKED,
          revokeReason: RevokeReason.NEW_LOGIN_SUPERSEDED,
          fcmToken: null,
        },
      });

      // 2. Revoke any ACTIVE session with the same fcmToken (different deviceIdentifier)
      if (fcmToken) {
        await tx.device.updateMany({
          where: {
            fcmToken,
            deviceIdentifier: { not: deviceIdentifier },
            status: DeviceStatus.ACTIVE,
          },
          data: {
            status: DeviceStatus.REVOKED,
            revokeReason: RevokeReason.FCM_SUPERSEDED,
            fcmToken: null,
          },
        });
      }

      // 3. Update user lastLoginAt
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
        include: {
          preferences: true,
        },
      });

      // 4. Create new device session
      const device = await tx.device.create({
        data: {
          userId: user.id,
          deviceIdentifier,
          fcmToken: fcmToken ?? null,
          platform: platform as Platform,
          status: DeviceStatus.ACTIVE,
          sessionExpiresAt,
        },
        select: {
          id: true,
        },
      });

      return { updatedUser, device };
    });

    const token = generateAccessTokenForUser({
      sub: updatedUser.id,
      deviceId: device.id,
      role: updatedUser.role,
      accountStatus: updatedUser.status,
      rememberMe,
    });
    await Promise.all([
      redisClient.set(
        createRedisKey(REDIS_PREFIXES.location, user.id),
        JSON.stringify({ lat, lng }),
        'EX',
        calculateMilliseconds(locationExpireAt, 'days')
      ),
      redisClient.geoadd(
        createRedisKey(REDIS_PREFIXES.locations),
        lng,
        lat,
        user.id
      ),
    ]);
    return;
  } catch (error) {
    throw error;
  }
};
