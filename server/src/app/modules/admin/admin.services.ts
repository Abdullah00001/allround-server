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
import {
  AdminCompanySettingsDTO,
  AdminDTO,
  AdminLanguagesDTO,
  AdminProfileDTO,
} from '@/app/modules/admin/admin.dto';
import { ITokenPayload } from '@/app/@types/jwt.types';
import {
  ICheckAdminServiceParams,
  ILoginAdminServiceParams,
  ILogoutAdminServiceParams,
  IRefreshAdminServiceParams,
  TChangeAdminPasswordServiceParams,
  TGetAdminProfileServiceParams,
  TUpdateAdminCompanySettingsPayload,
  TUpdateAdminLanguagesPayload,
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
import { clearCompanyDefaultLanguageCache } from '@/app/middlewares/locale.middlewares';
import { setLocale } from '@/app/configs/requestContext.configs';
import {
  buildCsvDocument,
  buildExportFilename,
} from '@/app/modules/admin/admin.export.utils';

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

  if (language !== undefined) {
    setLocale(language.toLowerCase().slice(0, 2));
  }

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

/** Default seed values when CompanyProfile row is missing. */
const DEFAULT_COMPANY_PROFILE = {
  id: 'global' as const,
  displayName: 'Allround Cockpit',
  officialName: 'Allround Gerüstbau GmbH',
  taxId: null as string | null,
  headOffice: null as string | null,
  logoUrl: null as string | null,
  siteManagerAccessRule: 'RESTRICT_TO_ASSIGNED',
  allowEmployeeManualTime: true,
  allowSiteManagerCreateProject: false,
  requireReasonForTimeEdit: false,
};

const companySettingsSelect = {
  displayName: true,
  officialName: true,
  taxId: true,
  headOffice: true,
  logoUrl: true,
  siteManagerAccessRule: true,
  allowEmployeeManualTime: true,
  allowSiteManagerCreateProject: true,
  requireReasonForTimeEdit: true,
  updatedAt: true,
} as const;

/**
 * Ensures the singleton CompanyProfile exists and returns settings fields.
 *
 * @returns {Promise<Parameters<typeof AdminCompanySettingsDTO.build>[0]>} Profile row.
 */
const ensureCompanyProfile = async (): Promise<
  Parameters<typeof AdminCompanySettingsDTO.build>[0]
> => {
  const existing = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: companySettingsSelect,
  });
  if (existing) return existing;

  return prisma.companyProfile.create({
    data: {
      ...DEFAULT_COMPANY_PROFILE,
      defaultLanguage: Language.DE,
      enabledLanguages: [Language.DE, Language.EN],
    },
    select: companySettingsSelect,
  });
};

/**
 * Loads company branding + access-policy settings for the admin Settings UI.
 *
 * @returns {Promise<AdminCompanySettingsDTO>} Company settings payload.
 */
export const getAdminCompanySettingsService =
  async (): Promise<AdminCompanySettingsDTO> => {
    const profile = await ensureCompanyProfile();
    return AdminCompanySettingsDTO.build(profile);
  };

/**
 * Patches company branding and/or access-policy fields on CompanyProfile.
 *
 * @param {TUpdateAdminCompanySettingsPayload} payload - Partial settings patch.
 * @returns {Promise<AdminCompanySettingsDTO>} Updated settings payload.
 */
export const updateAdminCompanySettingsService = async (
  payload: TUpdateAdminCompanySettingsPayload
): Promise<AdminCompanySettingsDTO> => {
  await ensureCompanyProfile();

  const updated = await prisma.companyProfile.update({
    where: { id: 'global' },
    data: {
      ...(payload.displayName !== undefined
        ? { displayName: payload.displayName }
        : {}),
      ...(payload.officialName !== undefined
        ? { officialName: payload.officialName }
        : {}),
      ...(payload.taxId !== undefined ? { taxId: payload.taxId } : {}),
      ...(payload.headOffice !== undefined
        ? { headOffice: payload.headOffice }
        : {}),
      ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
      ...(payload.siteManagerAccessRule !== undefined
        ? { siteManagerAccessRule: payload.siteManagerAccessRule }
        : {}),
      ...(payload.allowEmployeeManualTime !== undefined
        ? { allowEmployeeManualTime: payload.allowEmployeeManualTime }
        : {}),
      ...(payload.allowSiteManagerCreateProject !== undefined
        ? {
            allowSiteManagerCreateProject:
              payload.allowSiteManagerCreateProject,
          }
        : {}),
      ...(payload.requireReasonForTimeEdit !== undefined
        ? { requireReasonForTimeEdit: payload.requireReasonForTimeEdit }
        : {}),
    },
    select: companySettingsSelect,
  });

  return AdminCompanySettingsDTO.build(updated);
};

/**
 * Loads company Available languages settings (all 18 + toggles).
 *
 * @returns {Promise<AdminLanguagesDTO>} Languages grid payload.
 */
export const getAdminLanguagesService =
  async (): Promise<AdminLanguagesDTO> => {
    const profile = await prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: { defaultLanguage: true, enabledLanguages: true },
    });

    return AdminLanguagesDTO.build(
      profile?.defaultLanguage ?? Language.DE,
      profile?.enabledLanguages?.length
        ? profile.enabledLanguages
        : [Language.DE, Language.EN]
    );
  };

/**
 * Updates company default + enabled languages (Available languages UI).
 * Ensures default is always present in the enabled list.
 *
 * @param {TUpdateAdminLanguagesPayload} payload - Patch body.
 * @returns {Promise<AdminLanguagesDTO>} Updated languages grid.
 */
export const updateAdminLanguagesService = async (
  payload: TUpdateAdminLanguagesPayload
): Promise<AdminLanguagesDTO> => {
  const current = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { defaultLanguage: true, enabledLanguages: true },
  });

  const nextDefault =
    payload.defaultLanguage ?? current?.defaultLanguage ?? Language.DE;
  let nextEnabled =
    payload.enabledLanguages ??
    current?.enabledLanguages ??
    [Language.DE, Language.EN];

  if (!nextEnabled.includes(nextDefault)) {
    nextEnabled = [nextDefault, ...nextEnabled];
  }
  nextEnabled = [...new Set(nextEnabled)];

  const existing = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { id: true },
  });

  const updated = existing
    ? await prisma.companyProfile.update({
        where: { id: 'global' },
        data: {
          defaultLanguage: nextDefault,
          enabledLanguages: nextEnabled,
        },
        select: { defaultLanguage: true, enabledLanguages: true },
      })
    : await prisma.companyProfile.create({
        data: {
          id: 'global',
          displayName: 'Allround Cockpit',
          officialName: 'Allround Gerüstbau GmbH',
          siteManagerAccessRule: 'RESTRICT_TO_ASSIGNED',
          defaultLanguage: nextDefault,
          enabledLanguages: nextEnabled,
        },
        select: { defaultLanguage: true, enabledLanguages: true },
      });

  clearCompanyDefaultLanguageCache();

  return AdminLanguagesDTO.build(
    updated.defaultLanguage,
    updated.enabledLanguages
  );
};

/**
 * CSV file payload for admin Settings → Data export downloads.
 */
export type TAdminCsvExport = {
  /** Suggested download filename. */
  filename: string;
  /** CSV body (UTF-8 with BOM). */
  csv: string;
};

/**
 * Exports non-deleted projects as CSV for Settings → Export all projects.
 *
 * @returns {Promise<TAdminCsvExport>} CSV filename + body.
 */
export const exportAdminProjectsCsvService =
  async (): Promise<TAdminCsvExport> => {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, category: true } },
        projectManagers: {
          take: 1,
          orderBy: { assignedAt: 'asc' },
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    const headers = [
      'id',
      'name',
      'address',
      'city',
      'customerName',
      'customerCategory',
      'siteManagerName',
      'siteManagerEmail',
      'budgetedHours',
      'scaffoldArea',
      'contactName',
      'contactPhone',
      'contactEmail',
      'createdAt',
    ];

    const rows = projects.map((project) => {
      const sm = project.projectManagers[0]?.user;
      return [
        project.id,
        project.name,
        project.address,
        project.city,
        project.customer.name,
        project.customer.category,
        sm ? `${sm.firstName} ${sm.lastName}` : '',
        sm?.email ?? '',
        Number(project.budgetedHours),
        project.scaffoldArea === null ? '' : Number(project.scaffoldArea),
        project.contactName,
        project.contactPhone,
        project.contactEmail,
        project.createdAt,
      ];
    });

    return {
      filename: buildExportFilename('projects'),
      csv: buildCsvDocument(headers, rows),
    };
  };

/**
 * Exports non-deleted customers as CSV for Settings → Export customers.
 *
 * @returns {Promise<TAdminCsvExport>} CSV filename + body.
 */
export const exportAdminCustomersCsvService =
  async (): Promise<TAdminCsvExport> => {
    const customers = await prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1,
          select: { name: true, phone: true, email: true, role: true },
        },
        _count: { select: { projects: true, inspections: true } },
      },
    });

    const headers = [
      'id',
      'name',
      'category',
      'address',
      'city',
      'primaryContactName',
      'primaryContactRole',
      'primaryContactPhone',
      'primaryContactEmail',
      'projectCount',
      'inspectionCount',
      'createdAt',
    ];

    const rows = customers.map((customer) => {
      const contact = customer.contacts[0];
      return [
        customer.id,
        customer.name,
        customer.category,
        customer.address,
        customer.city,
        contact?.name ?? '',
        contact?.role ?? '',
        contact?.phone ?? '',
        contact?.email ?? '',
        customer._count.projects,
        customer._count.inspections,
        customer.createdAt,
      ];
    });

    return {
      filename: buildExportFilename('customers'),
      csv: buildCsvDocument(headers, rows),
    };
  };

/**
 * Exports time logs as CSV for Settings → Export time logs.
 *
 * @returns {Promise<TAdminCsvExport>} CSV filename + body.
 */
export const exportAdminTimeLogsCsvService =
  async (): Promise<TAdminCsvExport> => {
    const timeLogs = await prisma.timeLog.findMany({
      orderBy: { startTime: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, role: true },
        },
        phase: {
          select: {
            type: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    const headers = [
      'id',
      'userName',
      'userEmail',
      'userRole',
      'projectId',
      'projectName',
      'phaseType',
      'activityType',
      'startTime',
      'endTime',
      'status',
      'isManual',
      'editReason',
      'createdAt',
    ];

    const rows = timeLogs.map((log) => [
      log.id,
      `${log.user.firstName} ${log.user.lastName}`,
      log.user.email,
      log.user.role,
      log.phase.project.id,
      log.phase.project.name,
      log.phase.type,
      log.activityType,
      log.startTime,
      log.endTime,
      log.status,
      log.isManual,
      log.editReason,
      log.createdAt,
    ]);

    return {
      filename: buildExportFilename('time-logs'),
      csv: buildCsvDocument(headers, rows),
    };
  };
