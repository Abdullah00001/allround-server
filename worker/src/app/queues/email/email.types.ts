/**
 * Shared OTP email payload for account-create and resend flows.
 */
export interface IOtpEmailPayload {
  name: string;
  email: string;
  otp: string;
  /** OTP validity window label/minutes from producer. */
  otpExpireAt: string | number;
  traceId: string;
  /** Recipient language preference (e.g. `DE`, `EN`). */
  language?: string;
}

/**
 * Account-create success email payload.
 */
export type IAccountCreateSuccess = IOtpEmailPayload;

/**
 * Resend OTP email payload.
 */
export type IResendOtp = IOtpEmailPayload;

/**
 * Signup verification success email payload.
 */
export interface ISignupUserVerificationSuccessful {
  name: string;
  email: string;
  traceId: string;
  language?: string;
}

/**
 * Password-reset success email payload.
 */
export interface IResetRecoverUserPasswordSuccessful {
  name: string;
  email: string;
  traceId: string;
  language?: string;
}
