import crypto from 'crypto';
import { type Request } from 'express';
import { JsonWebTokenError, type JwtPayload, sign, verify } from 'jsonwebtoken';

import { AuthenticatedSocket, ITokenPayload } from '@/app/@types/jwt.types';
import logger from '@/app/configs/logger.configs';
import {
  AuthErrorType,
  refreshTokenExpiresInWithOutRememberMe,
  refreshTokenExpiresInWithRememberMe,
  resetOtpPageTokenExpiresIn,
} from '@/const';
import { env } from '@/env';

export function generateAccessTokenForUser(
  payload: ITokenPayload | null
): string {
  if (!payload) {
    throw new Error('Generate AccessToken Payload Cant Be Null');
  }

  const expiresAt = payload.rememberMe === true ? '30d' : '7d';

  return sign(payload, env.JWT_ACCESS_TOKEN_SECRET_KEY as string, {
    expiresIn: expiresAt,
  });
}

export function generateAccessTokenForAdmin(
  payload: ITokenPayload | null
): string {
  if (!payload) {
    throw new Error('Generate AccessToken Payload Cant Be Null');
  }

  return sign(payload, env.JWT_ACCESS_TOKEN_SECRET_KEY as string, {
    expiresIn: '15m',
  });
}

export function generateRefreshToken(payload: ITokenPayload): string {
  if (!payload) {
    throw new Error('Generate RefreshToken Payload Cant Be Null');
  }

  const expiresAt =
    payload.rememberMe === true
      ? refreshTokenExpiresInWithRememberMe
      : refreshTokenExpiresInWithOutRememberMe;

  return sign(payload, env.JWT_REFRESH_TOKEN_SECRET_KEY, {
    expiresIn: expiresAt,
    jwtid: crypto.randomUUID(),
  });
}

export function generateOtpPageToken(payload: ITokenPayload | null): string {
  if (!payload) {
    throw new Error('Generate Otp Page Token Payload Cant Be Null');
  }

  return sign(payload, env.JWT_VERIFY_OTP_PAGE_SECRET_KEY as string, {
    expiresIn: '1d',
  });
}

export function generateResetPasswordPageToken(
  payload: ITokenPayload | null
): string {
  if (!payload) {
    throw new Error('Generate Reset Password Page Token Payload Cant Be Null');
  }

  return sign(payload, env.JWT_RESET_PASSWORD_TOKEN_SECRET_KEY as string, {
    expiresIn: resetOtpPageTokenExpiresIn,
  });
}

export function verifyOtpPageToken(token: string | null): {
  data?: JwtPayload;
  error?: AuthErrorType.TOKEN_EXPIRED | AuthErrorType.TOKEN_INVALID;
} {
  if (!token) {
    throw new Error('Otp Page Token Is Missing');
  }

  try {
    return {
      data: verify(token, env.JWT_VERIFY_OTP_PAGE_SECRET_KEY) as JwtPayload,
    };
  } catch (error) {
    logger.error(error);
    if (error instanceof JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return { error: AuthErrorType.TOKEN_EXPIRED };
      } else {
        return { error: AuthErrorType.TOKEN_INVALID };
      }
    }
    return { error: AuthErrorType.TOKEN_INVALID };
  }
}

export function verifyResetPasswordPageToken(token: string | null): {
  data?: JwtPayload;
  error?: AuthErrorType.TOKEN_EXPIRED | AuthErrorType.TOKEN_INVALID;
} {
  if (!token) {
    throw new Error('Reset Password Page Token Is Missing');
  }

  try {
    return {
      data: verify(
        token,
        env.JWT_RESET_PASSWORD_TOKEN_SECRET_KEY as string
      ) as JwtPayload,
    };
  } catch (error) {
    logger.error(error);
    if (error instanceof JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return { error: AuthErrorType.TOKEN_EXPIRED };
      } else {
        return { error: AuthErrorType.TOKEN_INVALID };
      }
    }
    return { error: AuthErrorType.TOKEN_INVALID };
  }
}

export function verifyAccessToken(token: string | null): {
  data?: JwtPayload;
  error?: AuthErrorType.TOKEN_EXPIRED | AuthErrorType.TOKEN_INVALID;
} {
  if (!token) {
    throw new Error('Access Token Is Missing');
  }

  try {
    return {
      data: verify(token, env.JWT_ACCESS_TOKEN_SECRET_KEY) as JwtPayload,
    };
  } catch (error) {
    logger.error(error);
    if (error instanceof JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return { error: AuthErrorType.TOKEN_EXPIRED };
      } else {
        return { error: AuthErrorType.TOKEN_INVALID };
      }
    }
    return { error: AuthErrorType.TOKEN_INVALID };
  }
}

export function verifyRefreshToken(token: string): {
  data?: JwtPayload;
  error?: AuthErrorType.TOKEN_EXPIRED | AuthErrorType.TOKEN_INVALID;
} {
  if (!token) {
    throw new Error('Refresh Token Is Missing');
  }

  try {
    return {
      data: verify(token, env.JWT_REFRESH_TOKEN_SECRET_KEY) as JwtPayload,
    };
  } catch (error) {
    logger.error(error);
    if (error instanceof JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return { error: AuthErrorType.TOKEN_EXPIRED };
      } else {
        return { error: AuthErrorType.TOKEN_INVALID };
      }
    }
    return { error: AuthErrorType.TOKEN_INVALID };
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  // Validate format: "Bearer <token>"
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export function extractTokenFromSocketHeader(
  socket: AuthenticatedSocket
): string | null {
  const token =
    socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token || typeof token !== 'string') return null;
  if (token.startsWith('Bearer ')) {
    return token.slice(7).trim();
  }
  return token.trim();
}

