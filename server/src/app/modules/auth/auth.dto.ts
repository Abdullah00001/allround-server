import {
  Language,
  Role,
  User,
  UserPreference,
  UserStatus,
} from '@prisma/client';

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

  static build(user: User & { preferences?: UserPreference | null }) {
    return new SessionDTO(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.phone ?? '',
      user.avatarUrl,
      user.role,
      user.status,
      user.isProfileSetup,
      user.preferences?.language ?? Language.EN
    );
  }
}

export class LoginDTO {
  constructor(
    public token: string,
    public user: SessionDTO
  ) {}

  static build(token: string, user: SessionDTO) {
    return new LoginDTO(token, user);
  }
}
