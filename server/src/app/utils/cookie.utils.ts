import TCookieOptions from '@/app/@types/cookie.types';
import { env } from '@/env';

const isProd = env.NODE_ENV === 'production';

export function cookieOption(expiresIn: string): TCookieOptions {
  const option: TCookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'lax' : 'lax',
    path: '/',
  };

  if (env.COOKIE_DOMAIN) {
    option.domain = env.COOKIE_DOMAIN;
  }

  option.maxAge = parseExpiresIn(expiresIn);

  return option;
}

export function sharedCookieOption(): TCookieOptions {
  const option: TCookieOptions = {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 1 * 24 * 60 * 60 * 1000,
  };

  if (env.COOKIE_DOMAIN) {
    option.domain = env.COOKIE_DOMAIN;
  }

  return option;
}

/**
 * Parses time strings like: 500ms | 10s | 5m | 2h | 7d
 */
export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported time unit: ${unit}`);
  }
}
