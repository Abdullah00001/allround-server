import { z } from 'zod';
import { User } from '@prisma/client';
import {
  changePasswordSchema,
  updateLanguageSchema,
} from '@/app/modules/settings/settings.schema';

export type TChangePasswordPayload = z.infer<typeof changePasswordSchema>;
export type TUpdateLanguagePayload = z.infer<typeof updateLanguageSchema>;

/**
 * Service params for mobile self password change.
 */
export type TChangePasswordServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Current device id — kept active; other devices are revoked. */
  deviceId: string;
  /** Validated body. */
  payload: TChangePasswordPayload;
};

/**
 * Service params for mobile language preference update.
 */
export type TUpdateLanguageServiceParams = {
  /** Authenticated user. */
  user: User;
  /** Validated body (`language`). */
  payload: TUpdateLanguagePayload;
};
