import { Role, User, UserStatus } from '@prisma/client';

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
