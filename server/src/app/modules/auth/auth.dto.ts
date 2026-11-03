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
