import { Language, Role, User, UserStatus } from '@prisma/client';

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
