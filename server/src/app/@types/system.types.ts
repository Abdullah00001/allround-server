import { REDIS_PREFIXES } from "@/const";

export type TEnv = {
  NODE_ENV: string;
  SERVER_URL: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PASSWORD: string;
  REDIS_PORT: number;
  PORT: number;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_REGION: string;
  S3_BUCKET_NAME: string;
  S3_ENDPOINT: string;
  S3_PUBLIC_URL: string;
  JWT_ACCESS_TOKEN_SECRET_KEY: string;
  JWT_REFRESH_TOKEN_SECRET_KEY: string;
  JWT_VERIFY_OTP_PAGE_SECRET_KEY: string;
  OTP_HASH_SECRET: string;
  JWT_RESET_PASSWORD_TOKEN_SECRET_KEY: string;
  TRANSLATION_PROVIDER: string;
  GOOGLE_TRANSLATION_API_KEY: string;
};

/**
 * Options for generating an OTP.
 */
export interface OTPOptions {
  /** Include digits (0-9). */
  digits: boolean;
  /** Include lowercase letters (a-z). */
  lowerCaseAlphabets: boolean;
  /** Include uppercase letters (A-Z). */
  upperCaseAlphabets: boolean;
  /** Include special characters (e.g., !@#$%^&*). */
  specialChars: boolean;
}

export type TRedisPrefix = (typeof REDIS_PREFIXES)[keyof typeof REDIS_PREFIXES];
