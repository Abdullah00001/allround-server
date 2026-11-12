import { Language, User, UserPreference } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

import prisma from '@/app/configs/db.configs';
import {
  requestContext,
  setLocale,
} from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';

/** In-memory cache for CompanyProfile.defaultLanguage to avoid per-request DB hits. */
let cachedCompanyDefaultLanguage: Language | null = null;
let companyDefaultLoadedAt = 0;
const COMPANY_DEFAULT_TTL_MS = 60_000;

type UserWithPreferences = User & {
  preferences?: UserPreference | null;
};

/**
 * Loads and caches the company-wide default language from `CompanyProfile`.
 *
 * @returns {Promise<Language>} Company default language, falling back to `EN`.
 */
export const getCompanyDefaultLanguage = async (): Promise<Language> => {
  const now = Date.now();
  if (
    cachedCompanyDefaultLanguage &&
    now - companyDefaultLoadedAt < COMPANY_DEFAULT_TTL_MS
  ) {
    return cachedCompanyDefaultLanguage;
  }

  const profile = await prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { defaultLanguage: true },
  });

  cachedCompanyDefaultLanguage = profile?.defaultLanguage ?? Language.EN;
  companyDefaultLoadedAt = now;
  return cachedCompanyDefaultLanguage;
};

/**
 * Normalizes a language tag to a two-letter lowercase locale (e.g. `DE` → `de`).
 *
 * @param {string | null | undefined} value - Raw language tag.
 * @returns {string | null} Normalized locale, or null when empty/invalid.
 */
export const normalizeLocale = (
  value: string | null | undefined
): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase().slice(0, 2);
  return normalized.length === 2 ? normalized : null;
};

/**
 * Parses an Accept-Language header per RFC 7231, sorted by descending q-value.
 *
 * @param {string} header - Raw Accept-Language header value.
 * @returns {string[]} Ordered two-letter language candidates.
 */
export const parseAcceptLanguageHeader = (header: string): string[] => {
  return header
    .split(',')
    .map((entry) => {
      const parts = entry.split(';');
      const lang = parts[0]?.trim().toLowerCase().slice(0, 2) ?? '';
      let q = 1.0;
      for (let i = 1; i < parts.length; i++) {
        const match = parts[i]?.trim().match(/^q=([0-9.]+)/i);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (!Number.isNaN(parsed)) {
            q = parsed;
          }
        }
      }
      return { lang, q };
    })
    .filter((item) => item.q > 0 && item.lang.length === 2)
    .sort((a, b) => b.q - a.q)
    .map((item) => item.lang);
};

/**
 * Resolves the request locale with this precedence:
 * 1. Explicit API override (`?locale=` / `?lang=` / `x-locale`)
 * 2. Authenticated user's `UserPreference.language` when `req.user` is loaded
 * 3. `Accept-Language` header candidates
 * 4. `CompanyProfile.defaultLanguage`
 * 5. `en`
 *
 * @param {Request} req - Express request (may already include `req.user`).
 * @returns {Promise<string>} Resolved two-letter locale.
 */
export const resolveRequestedLocale = async (req: Request): Promise<string> => {
  const explicit = normalizeLocale(
    (req.query?.locale as string | undefined) ||
      (req.query?.lang as string | undefined) ||
      (req.headers['x-locale'] as string | undefined)
  );
  if (explicit) {
    return explicit;
  }

  const user = req.user as UserWithPreferences | undefined;
  const preferenceLocale = normalizeLocale(user?.preferences?.language);
  if (preferenceLocale) {
    return preferenceLocale;
  }

  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const candidates = parseAcceptLanguageHeader(acceptLang);
    if (candidates[0]) {
      return candidates[0];
    }
  }

  const companyDefault = await getCompanyDefaultLanguage();
  return normalizeLocale(companyDefault) ?? 'en';
};

/**
 * Global middleware that stores the resolved locale in AsyncLocalStorage.
 * Runs early (before auth); preference-based locale is applied later via
 * `syncLocaleFromAuthenticatedUserMiddleware`.
 *
 * @param {Request} req - Express request.
 * @param {Response} _res - Express response (unused).
 * @param {NextFunction} next - Continues the middleware chain.
 * @returns {Promise<void>}
 */
export const localeMiddleware = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const resolved = await resolveRequestedLocale(req);
    const store = requestContext.getStore();
    if (store) {
      store.locale = resolved;
    }
    next();
  }
);

/**
 * Re-resolves locale after auth middlewares load `req.user` (with preferences)
 * and writes the result into AsyncLocalStorage for downstream `t()` calls.
 *
 * @param {Request} req - Authenticated Express request.
 * @param {Response} _res - Express response (unused).
 * @param {NextFunction} next - Continues the middleware chain.
 * @returns {Promise<void>}
 */
export const syncLocaleFromAuthenticatedUserMiddleware = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const resolved = await resolveRequestedLocale(req);
    setLocale(resolved);
    next();
  }
);
