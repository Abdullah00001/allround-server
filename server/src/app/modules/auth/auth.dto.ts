import { Language, Role, User, UserPreference, UserStatus } from '@prisma/client';

export class SignupServiceDTO {
  constructor(
    public name: string,
    public email: string,
    public role: string,
    public token: string
  ) {}

  public static build(
    name: string,
    email: string,
    role: string,
    token: string
  ) {
    return new SignupServiceDTO(name, email, role, token);
  }
}

export class VerifySignupUserDTO {
  constructor(
    public accessToken: string,
    public isProfileSetup: boolean,
    public role: Role,
    public accountStatus: UserStatus,
    public id: string,
    public fullName: string,
    public avatarUrl: string | null
  ) {}

  static build(token: string, user: User) {
    return new VerifySignupUserDTO(
      token,
      user.isProfileSetup,
      user.role,
      user.status,
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.avatarUrl
    );
  }
}

export class SessionDTO {
  constructor(
    public userId: string,
    public fullName: string,
    public email: string,
    public phone: string,
    public avatarUrl: string | null,
    public role: Role,
    public status: UserStatus,
    public isProfileSetup: boolean,
    public language: Language
  ) {}

  static buildSession(user: User & { preferences?: UserPreference | null }) {
    return new SessionDTO(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.phone ?? '',
      user.avatarUrl,
      user.role,
      user.status,
      user.isProfileSetup,
      // Defensive fallback for users created before the UserPreference
      // backfill, or in edge cases where the preference row was deleted.
      // After migration, every active user should have a preferences row.
      user.preferences?.language ?? Language.EN
    );
  }
}