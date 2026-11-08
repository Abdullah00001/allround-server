// Types specific to the email queue can be defined here
// export interface IEmailJobData { ... }

export interface IAccountCreateSuccess {
  // Add properties here
  name: string;
  email: string;
  otp: string;
  otpExpiredAt: string;
  traceId: string;
}

export interface IResendOtp {
  // Add properties here
  name: string;
  email: string;
  otp: string;
  otpExpiredAt: string;
  traceId: string;
}

export interface ISignupUserVerificationSuccessful {
  // Add properties here
  name: string;
  email: string;
  traceId: string;
}

export interface IResetRecoverUserPasswordSuccessful {
  name: string;
  email: string;
  traceId: string;
}
