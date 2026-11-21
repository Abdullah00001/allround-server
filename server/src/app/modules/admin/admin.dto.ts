import { Language, Role, User, UserStatus } from '@prisma/client';
import { LANGUAGE_CATALOG } from '@/const';
import type { ILocalizationMeta } from '@/app/services/translation/translation.types';

export class AdminDTO {
  constructor(
    public id: string,
    public fullName: string,
    public email: string,
    public phone: string,
    public avatarUrl: string | null,
    public role: Role,
    public status: UserStatus
  ) {}

  static build(user: User) {
    return new AdminDTO(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.phone ?? '',
      user.avatarUrl,
      user.role,
      user.status
    );
  }
}

export class AdminLoginDTO {
  constructor(public admin: AdminDTO) {}

  static build(admin: AdminDTO) {
    return new AdminLoginDTO(admin);
  }
}

export class AdminSessionDTO {
  constructor(public admin: AdminDTO) {}

  static build(admin: AdminDTO) {
    return new AdminSessionDTO(admin);
  }
}

/**
 * Self-profile payload for the admin dashboard Settings / Profile screen.
 */
export class AdminProfileDTO {
  /** Alua localization metadata for `firstName` / `lastName`. */
  localization?: ILocalizationMeta;

  /**
   * @param {string} id - Admin user UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string} email - Email (read-only on PATCH).
   * @param {string | null} phone - Optional phone.
   * @param {string | null} avatarUrl - Optional avatar URL.
   * @param {Role} role - Always ADMIN.
   * @param {Language} language - Preferred UI language.
   * @param {Date} createdAt - Account creation timestamp.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public phone: string | null,
    public avatarUrl: string | null,
    public role: Role,
    public language: Language,
    public createdAt: Date
  ) {}

  /**
   * Builds an admin profile DTO.
   *
   * @param {User} user - Admin user row.
   * @param {Language} language - Language from UserPreference (default EN).
   * @returns {AdminProfileDTO} API-safe profile.
   */
  static build(user: User, language: Language = Language.EN) {
    return new AdminProfileDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.avatarUrl,
      user.role,
      language,
      user.createdAt
    );
  }
}

/**
 * One row in the admin Available languages grid.
 */
export class AdminLanguageOptionDTO {
  /**
   * @param {Language} code - Prisma Language enum.
   * @param {string} displayCode - UI flag code (GB, RS, UA, …).
   * @param {string} name - English display name.
   * @param {string} locale - ISO locale for Translate / x-locale.
   * @param {boolean} enabled - Whether company has this language enabled.
   * @param {boolean} isDefault - Whether this is CompanyProfile.defaultLanguage.
   */
  constructor(
    public code: Language,
    public displayCode: string,
    public name: string,
    public locale: string,
    public enabled: boolean,
    public isDefault: boolean
  ) {}
}

/**
 * Admin Settings → General branding + Access policies (`CompanyProfile`).
 */
export class AdminCompanySettingsDTO {
  /**
   * @param {string} displayName - App display name.
   * @param {string} officialName - Official company name.
   * @param {string | null} taxId - Registration / tax ID.
   * @param {string | null} headOffice - Head office address.
   * @param {string | null} logoUrl - Company logo URL (after `POST /media`).
   * @param {string} siteManagerAccessRule - `RESTRICT_TO_ASSIGNED` | `GLOBAL_ACCESS`.
   * @param {boolean} allowEmployeeManualTime - Employees may submit manual time.
   * @param {boolean} allowSiteManagerCreateProject - SMs may create projects from the field.
   * @param {boolean} requireReasonForTimeEdit - Admin time-log edits require reason.
   * @param {string} updatedAt - ISO last-updated timestamp.
   */
  constructor(
    public displayName: string,
    public officialName: string,
    public taxId: string | null,
    public headOffice: string | null,
    public logoUrl: string | null,
    public siteManagerAccessRule: string,
    public allowEmployeeManualTime: boolean,
    public allowSiteManagerCreateProject: boolean,
    public requireReasonForTimeEdit: boolean,
    public updatedAt: string
  ) {}

  /**
   * Builds the company settings DTO from a CompanyProfile row.
   *
   * @param {{
   *   displayName: string;
   *   officialName: string;
   *   taxId: string | null;
   *   headOffice: string | null;
   *   logoUrl: string | null;
   *   siteManagerAccessRule: string;
   *   allowEmployeeManualTime: boolean;
   *   allowSiteManagerCreateProject: boolean;
   *   requireReasonForTimeEdit: boolean;
   *   updatedAt: Date;
   * }} profile - CompanyProfile fields.
   * @returns {AdminCompanySettingsDTO} Settings payload for the admin UI.
   */
  static build(profile: {
    displayName: string;
    officialName: string;
    taxId: string | null;
    headOffice: string | null;
    logoUrl: string | null;
    siteManagerAccessRule: string;
    allowEmployeeManualTime: boolean;
    allowSiteManagerCreateProject: boolean;
    requireReasonForTimeEdit: boolean;
    updatedAt: Date;
  }): AdminCompanySettingsDTO {
    return new AdminCompanySettingsDTO(
      profile.displayName,
      profile.officialName,
      profile.taxId,
      profile.headOffice,
      profile.logoUrl,
      profile.siteManagerAccessRule,
      profile.allowEmployeeManualTime,
      profile.allowSiteManagerCreateProject,
      profile.requireReasonForTimeEdit,
      profile.updatedAt.toISOString()
    );
  }
}

/**
 * Admin Settings → Available languages payload (all 18 languages).
 */
export class AdminLanguagesDTO {
  /**
   * @param {Language} defaultLanguage - Company default.
   * @param {Language[]} enabledLanguages - Enabled subset.
   * @param {AdminLanguageOptionDTO[]} languages - Full catalog with toggles.
   */
  constructor(
    public defaultLanguage: Language,
    public enabledLanguages: Language[],
    public languages: AdminLanguageOptionDTO[]
  ) {}

  /**
   * Builds the languages settings DTO from CompanyProfile fields.
   *
   * @param {Language} defaultLanguage - Default language.
   * @param {Language[]} enabledLanguages - Enabled languages.
   * @returns {AdminLanguagesDTO} API payload for the settings grid.
   */
  static build(
    defaultLanguage: Language,
    enabledLanguages: Language[]
  ): AdminLanguagesDTO {
    const enabledSet = new Set(enabledLanguages);
    const languages = LANGUAGE_CATALOG.map(
      (row) =>
        new AdminLanguageOptionDTO(
          row.code as Language,
          row.displayCode,
          row.name,
          row.locale,
          enabledSet.has(row.code as Language) || row.code === defaultLanguage,
          row.code === defaultLanguage
        )
    );
    return new AdminLanguagesDTO(
      defaultLanguage,
      [...new Set([defaultLanguage, ...enabledLanguages])],
      languages
    );
  }
}
