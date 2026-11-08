import { Role, UserStatus } from '@prisma/client';

/**
 * DTO returned when a recover user is found and OTP is sent.
 */
export class FindRecoverUserServiceDTO {
  constructor(
    public fullName: string,
    public email: string,
    public role: Role,
    public status: UserStatus,
    public avatar: string | null,
    public token: string
  ) {}

  static build({
    fullName,
    email,
    role,
    status,
    avatar,
    token,
  }: FindRecoverUserServiceDTO) {
    return new FindRecoverUserServiceDTO(
      fullName,
      email,
      role,
      status,
      avatar,
      token
    );
  }
}
