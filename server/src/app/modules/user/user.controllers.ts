import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  createUserService,
  deleteUserService,
  getUserByIdService,
  listUsersService,
  updateUserService,
} from '@/app/modules/user/user.services';
import {
  TCreateUserPayload,
  TGetUsersQuery,
  TUpdateUserPayload,
} from '@/app/modules/user/user.types';

/**
 * Handles `POST /admin/users`.
 * Creates an admin-provisioned workforce user.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateUserPayload;
    const data = await createUserService({ payload });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/users`.
 * Returns a paginated managed-user list.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listUsersController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetUsersQuery;
    const { items, total, page, limit } = await listUsersService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/users/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.managedUser`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getUserByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.managedUser as User;
    const data = await getUserByIdService({ user });

    res.status(200).json({
      success: true,
      message: 'User fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/users/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.managedUser` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.managedUser as User;
    const payload = req.body as TUpdateUserPayload;
    const data = await updateUserService({ user, payload });

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/users/:id`.
 * Soft-deletes the user and revokes active devices.
 *
 * @param {Request} req - Express request with trusted `req.managedUser`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.managedUser as User;
    const data = await deleteUserService({ user });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);
