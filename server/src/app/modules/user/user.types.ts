import { z } from 'zod';
import { User } from '@prisma/client';
import {
  createUserSchema,
  getUsersQuerySchema,
  updateUserSchema,
} from '@/app/modules/user/user.schema';

/**
 * Validated create-user request body.
 */
export type TCreateUserPayload = z.infer<typeof createUserSchema>;

/**
 * Validated update-user request body.
 */
export type TUpdateUserPayload = z.infer<typeof updateUserSchema>;

/**
 * Validated list-users query string.
 */
export type TGetUsersQuery = z.infer<typeof getUsersQuerySchema>;

/**
 * Service params for creating a user.
 */
export type TCreateUserServiceParams = {
  /** Validated create payload. */
  payload: TCreateUserPayload;
};

/**
 * Service params for listing users.
 */
export type TListUsersServiceParams = {
  /** Validated list query. */
  query: TGetUsersQuery;
};

/**
 * Service params for fetching one managed user.
 */
export type TGetUserByIdServiceParams = {
  /** Trusted non-deleted user from existence middleware. */
  user: User;
};

/**
 * Service params for updating a managed user.
 */
export type TUpdateUserServiceParams = {
  /** Trusted non-deleted user from existence middleware. */
  user: User;
  /** Validated partial update payload. */
  payload: TUpdateUserPayload;
};

/**
 * Service params for soft-deleting a managed user.
 */
export type TDeleteUserServiceParams = {
  /** Trusted non-deleted user from existence middleware. */
  user: User;
};
