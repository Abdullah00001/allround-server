import { TEnv } from '@/app/@types/system.types';
import { getEnv } from '@/app/utils/env.utils';

export const env: TEnv = {
  NODE_ENV: getEnv('NODE_ENV'),
  DATABASE_URL: getEnv('DATABASE_URL'),
  REDIS_HOST: getEnv('REDIS_HOST'),
  REDIS_PASSWORD: getEnv('REDIS_PASSWORD'),
  REDIS_PORT: Number(getEnv('REDIS_PORT')),
  REDIS_TLS: getEnv('REDIS_TLS') === 'true',
  TRANSLATION_PROVIDER: getEnv('TRANSLATION_PROVIDER'),
  GOOGLE_TRANSLATION_API_KEY: getEnv('GOOGLE_TRANSLATION_API_KEY'),
};
