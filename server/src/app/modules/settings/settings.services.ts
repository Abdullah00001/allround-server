import { DeviceStatus, RevokeReason } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { hashPassword } from '@/app/utils/password.utils';
import { TChangePasswordServiceParams } from '@/app/modules/settings/settings.types';

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
