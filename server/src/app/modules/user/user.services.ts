import {
  DeviceStatus,
  Prisma,
  RevokeReason,
  UserStatus,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { hashPassword } from '@/app/utils/password.utils';
import {
  ManagedUserDetailDTO,
  ManagedUserListItemDTO,
  ManagedUserSummaryDTO,
} from '@/app/modules/user/user.dto';
import {
  TCreateUserServiceParams,
  TDeleteUserServiceParams,
  TGetUserByIdServiceParams,
  TListUsersServiceParams,
  TUpdateUserServiceParams,
} from '@/app/modules/user/user.types';

/**
 * Creates an admin-provisioned user with hashed password and default preferences.
 * Sets `status: ACTIVE` so OTP verification is not required.
 *
 * @param {TCreateUserServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<ManagedUserSummaryDTO>} Created user summary (no password hash).
 */
export const createUserService = async ({
  payload,
}: TCreateUserServiceParams): Promise<ManagedUserSummaryDTO> => {
  const {
    password,
    weeklyHoursTarget,
    firstName,
    lastName,
    email,
    role,
    phone,
  } = payload;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      role,
      phone,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      isProfileSetup: true,
      weeklyHoursTarget: new Prisma.Decimal(weeklyHoursTarget),
      preferences: {
        create: {},
      },
    },
  });

  return ManagedUserSummaryDTO.build(user);
};

/**
 * Lists non-deleted users with optional search/role/status filters and pagination.
 * Includes counts of project management and crew assignments.
 *
 * @param {TListUsersServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: ManagedUserListItemDTO[]; total: number; page: number; limit: number }>}
 * Paginated list rows plus total for meta construction.
 */
export const listUsersService = async ({
  query,
}: TListUsersServiceParams): Promise<{
  items: ManagedUserListItemDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, search, role, status } = query;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            projectManagements: true,
            crewAssignments: true,
          },
        },
      },
    }),
  ]);

  return {
    items: users.map(ManagedUserListItemDTO.build),
    total,
    page,
    limit,
  };
};

/**
 * Loads a managed user detail with assigned projects and latest 5 time logs.
 * Assumes existence middleware already verified the user.
 *
 * @param {TGetUserByIdServiceParams} params - Trusted user wrapper.
 * @returns {Promise<ManagedUserDetailDTO>} User detail DTO.
 */
export const getUserByIdService = async ({
  user,
}: TGetUserByIdServiceParams): Promise<ManagedUserDetailDTO> => {
  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      projectManagements: {
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { assignedAt: 'desc' },
      },
      timeLogs: {
        orderBy: { startTime: 'desc' },
        take: 5,
        select: {
          id: true,
          activityType: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      },
    },
  });

  return ManagedUserDetailDTO.build(record);
};

/**
 * Updates a managed user profile/role/status/hours.
 * Hashes password when provided.
 *
 * @param {TUpdateUserServiceParams} params - Trusted user and payload.
 * @returns {Promise<ManagedUserSummaryDTO>} Updated user summary.
 */
export const updateUserService = async ({
  user,
  payload,
}: TUpdateUserServiceParams): Promise<ManagedUserSummaryDTO> => {
  const { password, weeklyHoursTarget, ...rest } = payload;
  const passwordHash =
    password !== undefined ? await hashPassword(password) : undefined;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...rest,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(weeklyHoursTarget !== undefined
        ? { weeklyHoursTarget: new Prisma.Decimal(weeklyHoursTarget) }
        : {}),
    },
  });

  return ManagedUserSummaryDTO.build(updated);
};

/**
 * Soft-deletes a managed user: sets `deletedAt`, `status: INACTIVE`,
 * and revokes all active device sessions.
 *
 * @param {TDeleteUserServiceParams} params - Trusted user wrapper.
 * @returns {Promise<{ id: string }>} Soft-deleted user id.
 */
export const deleteUserService = async ({
  user,
}: TDeleteUserServiceParams): Promise<{ id: string }> => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
      },
    });

    await tx.device.updateMany({
      where: {
        userId: user.id,
        status: {
          in: [DeviceStatus.ACTIVE, DeviceStatus.INACTIVE],
        },
      },
      data: {
        status: DeviceStatus.REVOKED,
        revokeReason: RevokeReason.ADMIN_KICK,
      },
    });
  });

  return { id: user.id };
};
