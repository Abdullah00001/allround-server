import { DeviceStatus, RevokeReason } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { setLocale } from '@/app/configs/requestContext.configs';
import { hashPassword } from '@/app/utils/password.utils';
import { SettingsDTO } from '@/app/modules/settings/settings.dto';
import {
  TChangePasswordServiceParams,
  TUpdateLanguageServiceParams,
} from '@/app/modules/settings/settings.types';

/**
 * Changes the authenticated mobile user's password and revokes other devices.
 * Current-password / reuse checks are performed by middleware upstream.
 *
 * @param {TChangePasswordServiceParams} params - User, current device, payload.
 * @returns {Promise<void>}
 */
export const changePasswordService = async ({
  user,
  deviceId,
  payload,
}: TChangePasswordServiceParams): Promise<void> => {
  const hashedNewPassword = await hashPassword(payload.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedNewPassword },
    });

    await tx.device.updateMany({
      where: {
        userId: user.id,
        id: { not: deviceId },
        status: DeviceStatus.ACTIVE,
      },
      data: {
        status: DeviceStatus.REVOKED,
        revokeReason: RevokeReason.PASSWORD_CHANGED,
        fcmToken: null,
      },
    });
  });
};

/**
 * Upserts the authenticated user's preferred language and applies it to ALS.
 *
 * @param {TUpdateLanguageServiceParams} params - User and language payload.
 * @returns {Promise<SettingsDTO>} Updated settings snapshot.
 */
export const updateLanguageService = async ({
  user,
  payload,
}: TUpdateLanguageServiceParams): Promise<SettingsDTO> => {
  const preferences = await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, language: payload.language },
    update: { language: payload.language },
  });

  setLocale(payload.language.toLowerCase().slice(0, 2));

  return SettingsDTO.build(preferences);
};
