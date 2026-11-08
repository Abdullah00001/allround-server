import { Role, User, UserStatus } from '@prisma/client';

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
