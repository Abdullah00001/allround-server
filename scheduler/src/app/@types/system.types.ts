export type TEnv = {
  NODE_ENV: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PASSWORD: string;
  REDIS_PORT: number;
  /** When true, ioredis uses TLS (managed Redis). Self-host compose uses false. */
  REDIS_TLS: boolean;
  TRANSLATION_PROVIDER: string;
  GOOGLE_TRANSLATION_API_KEY: string;
};
