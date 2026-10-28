import { UserStatus } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';
import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';

export interface ITokenPayload extends JwtPayload {
  sub: string;
  deviceId?: string;
  rememberMe?: boolean;
  role: string;
  accountStatus: UserStatus;
}

export type { AuthenticatedSocket };


