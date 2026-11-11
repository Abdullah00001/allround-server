import { Request, Response } from 'express';
import { Customer } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  addCustomerContactService,
  createCustomerService,
  getCustomerByIdService,
  listCustomersService,
  updateCustomerService,
} from '@/app/modules/customer/customer.services';
import {
  TCreateContactPayload,
  TCreateCustomerPayload,
  TGetCustomersQuery,
  TUpdateCustomerPayload,
} from '@/app/modules/customer/customer.types';

/**
 * Handles `POST /admin/customers`.
 * Creates a customer (and optional contacts) and returns a 201 success envelope.
 *
 * @param {Request} req - Express request with validated body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createCustomerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const payload = req.body as TCreateCustomerPayload;
    const data = await createCustomerService({ payload });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/customers`.
 * Returns a paginated customer list with standard meta links.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listCustomersController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetCustomersQuery;
    const { items, total, page, limit } = await listCustomersService({
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Customers fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/customers/:id`.
 * Relies on existence middleware; returns customer detail with contacts/projects.
 *
 * @param {Request} req - Express request with trusted `req.customer`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getCustomerByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const customer = req.customer as Customer;
    const data = await getCustomerByIdService({ customerId: customer.id });

    res.status(200).json({
      success: true,
      message: 'Customer fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/customers/:id`.
 * Relies on existence middleware; returns the updated customer summary.
 *
 * @param {Request} req - Express request with trusted `req.customer` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateCustomerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const customer = req.customer as Customer;
    const payload = req.body as TUpdateCustomerPayload;
    const data = await updateCustomerService({ customer, payload });

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/customers/:id/contacts`.
 * Relies on existence middleware; returns the created contact.
 *
 * @param {Request} req - Express request with trusted `req.customer` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const addCustomerContactController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const customer = req.customer as Customer;
    const payload = req.body as TCreateContactPayload;
    const data = await addCustomerContactService({ customer, payload });

    res.status(201).json({
      success: true,
      message: 'Contact added successfully.',
      data,
      traceId,
    });
    return;
  }
);
