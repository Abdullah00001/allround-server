import crypto from 'crypto';
import prisma from '@/app/configs/db.configs';
import { getRedisClient } from '@/app/configs/redis.configs';
import {
  createRedisKey,
  expiresInTimeUnitToMs,
} from '@/app/utils/system.utils';
import { hashToken } from '@/app/utils/crypto.utils';
import {
  generateAccessTokenForAdmin,
  generateRefreshToken,
} from '@/app/utils/jwt.utils';
import { AdminDTO, AdminProfileDTO } from '@/app/modules/admin/admin.dto';
import { ITokenPayload } from '@/app/@types/jwt.types';
import {
  ICheckAdminServiceParams,
  ILoginAdminServiceParams,
  ILogoutAdminServiceParams,
  IRefreshAdminServiceParams,
  TChangeAdminPasswordServiceParams,
  TGetAdminProfileServiceParams,
  TUpdateAdminProfileServiceParams,
} from '@/app/modules/admin/admin.types';
import {
  adminAccessTokenExpiresIn,
  REDIS_PREFIXES,
  refreshTokenExpiresInWithOutRememberMe,
  refreshTokenExpiresInWithRememberMe,
} from '@/const';
import { Language } from '@prisma/client';
import { hashPassword } from '@/app/utils/password.utils';

/**
 * Admin login: update lastLoginAt, issue tokens, register Redis refresh session.
 */
export const loginAdminService = async ({
  user,
  rememberMe,
}: ILoginAdminServiceParams): Promise<{
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  admin: AdminDTO;
}> => {
  const redisClient = getRedisClient();
  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const tokenPayload: ITokenPayload = {
      sub: updatedUser.id,
      role: updatedUser.role,
      accountStatus: updatedUser.status,
      rememberMe,
    };

    const accessToken = generateAccessTokenForAdmin(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const csrfToken = crypto.randomBytes(32).toString('hex');

    const hashedRefreshToken = hashToken(refreshToken);
    const duration = rememberMe
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;
    const refreshTokenTTL = Math.floor(expiresInTimeUnitToMs(duration) / 1000);

    const sessionKey = createRedisKey(
      REDIS_PREFIXES.adminSession,
      updatedUser.id,
      hashedRefreshToken
    );
    await redisClient.set(sessionKey, '1', 'EX', refreshTokenTTL);

    return {
      accessToken,
      refreshToken,
      csrfToken,
      admin: AdminDTO.build(updatedUser),
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Return authenticated admin session DTO.
 */
export const checkAdminService = async ({
  user,
}: ICheckAdminServiceParams): Promise<{ admin: AdminDTO }> => {
  try {
    return {
      admin: AdminDTO.build(user),
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Atomically consume old refresh session and issue new tokens.
 */
export const refreshAdminService = async ({
  user,
  refreshToken,
  rememberMe,
}: IRefreshAdminServiceParams): Promise<{
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
} | null> => {
  const redisClient = getRedisClient();
  try {
    const hashedRefreshToken = hashToken(refreshToken);
    const sessionKey = createRedisKey(
      REDIS_PREFIXES.adminSession,
      user.id,
      hashedRefreshToken
    );

    const deletedCount = await redisClient.del(sessionKey);
    if (deletedCount === 0) {
      return null;
    }

    const tokenPayload: ITokenPayload = {
      sub: user.id,
      role: user.role,
      accountStatus: user.status,
      rememberMe,
    };

    const newAccessToken = generateAccessTokenForAdmin(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);
    const newCsrfToken = crypto.randomBytes(32).toString('hex');

    const newHashedRefreshToken = hashToken(newRefreshToken);
    const duration = rememberMe
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;
    const refreshTokenTTL = Math.floor(expiresInTimeUnitToMs(duration) / 1000);

    const newSessionKey = createRedisKey(
      REDIS_PREFIXES.adminSession,
      user.id,
      newHashedRefreshToken
    );
    await redisClient.set(newSessionKey, '1', 'EX', refreshTokenTTL);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      csrfToken: newCsrfToken,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Delete Redis refresh session and blacklist the current access token.
 */
export const logoutAdminService = async ({
  user,
  accessToken,
  refreshToken,
}: ILogoutAdminServiceParams): Promise<void> => {
  const redisClient = getRedisClient();
  try {
    if (refreshToken) {
      const hashedRefreshToken = hashToken(refreshToken);
      const sessionKey = createRedisKey(
        REDIS_PREFIXES.adminSession,
        user.id,
        hashedRefreshToken
      );
      await redisClient.del(sessionKey);
    }

    if (accessToken) {
      const accessTokenTTL = Math.floor(
        expiresInTimeUnitToMs(adminAccessTokenExpiresIn) / 1000
      );
      const blacklistKey = createRedisKey(
        REDIS_PREFIXES.blacklist,
        accessToken
      );
      await redisClient.set(blacklistKey, '1', 'EX', accessTokenTTL);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Loads the authenticated admin's self-profile (identity + language preference).
 *
 * @param {TGetAdminProfileServiceParams} params - Trusted admin user.
 * @returns {Promise<AdminProfileDTO>} Profile payload for the dashboard.
 */
export const getAdminProfileService = async ({
  user,
}: TGetAdminProfileServiceParams): Promise<AdminProfileDTO> => {
  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { language: true },
  });

  return AdminProfileDTO.build(user, preference?.language ?? Language.EN);
};

/**
 * Updates the authenticated admin's self-profile fields.
 * Upserts `UserPreference.language` when `language` is present.
 *
 * @param {TUpdateAdminProfileServiceParams} params - User and patch payload.
 * @returns {Promise<AdminProfileDTO>} Updated profile payload.
 */
export const updateAdminProfileService = async ({
  user,
  payload,
}: TUpdateAdminProfileServiceParams): Promise<AdminProfileDTO> => {
  const { firstName, lastName, phone, avatarUrl, language } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    if (language !== undefined) {
      await tx.userPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, language },
        update: { language },
      });
    }
  });

  const refreshed = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });

  return getAdminProfileService({ user: refreshed });
};

/**
 * Changes the admin password and revokes all Redis admin sessions.
 * Caller clears auth cookies after this succeeds.
 *
 * @param {TChangeAdminPasswordServiceParams} params - User id and new password.
 * @returns {Promise<void>}
 */
export const changeAdminPasswordService = async ({
  userId,
  newPassword,
}: TChangeAdminPasswordServiceParams): Promise<void> => {
  const redisClient = getRedisClient();
  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });

  const sessionPattern = createRedisKey(
    REDIS_PREFIXES.adminSession,
    userId,
    '*'
  );
  const sessionKeys = await redisClient.keys(sessionPattern);
  if (sessionKeys.length > 0) {
    await redisClient.del(...sessionKeys);
  }
};
