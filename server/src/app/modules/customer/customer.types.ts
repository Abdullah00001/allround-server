import { z } from 'zod';
import { Customer } from '@prisma/client';
import {
  createContactSchema,
  createCustomerSchema,
  getCustomersQuerySchema,
  updateCustomerSchema,
} from '@/app/modules/customer/customer.schema';

/**
 * Validated request body for creating a customer (and optional contacts).
 */
export type TCreateCustomerPayload = z.infer<typeof createCustomerSchema>;

/**
 * Validated request body for partially updating a customer.
 */
export type TUpdateCustomerPayload = z.infer<typeof updateCustomerSchema>;

/**
 * Validated query string for listing customers with pagination/filters.
 */
export type TGetCustomersQuery = z.infer<typeof getCustomersQuerySchema>;

/**
 * Validated request body for adding a contact to an existing customer.
 */
export type TCreateContactPayload = z.infer<typeof createContactSchema>;

/**
 * Service parameters for creating a customer.
 */
export type TCreateCustomerServiceParams = {
  /** Validated create payload from the request body. */
  payload: TCreateCustomerPayload;
};

/**
 * Service parameters for listing customers.
 */
export type TListCustomersServiceParams = {
  /** Validated list query (page, limit, search, category). */
  query: TGetCustomersQuery;
};

/**
 * Service parameters for fetching a single customer detail.
 */
export type TGetCustomerByIdServiceParams = {
  /** Trusted customer id already verified by existence middleware. */
  customerId: string;
};

/**
 * Service parameters for updating a customer.
 */
export type TUpdateCustomerServiceParams = {
  /** Trusted customer entity attached by existence middleware. */
  customer: Customer;
  /** Validated partial update payload. */
  payload: TUpdateCustomerPayload;
};

/**
 * Service parameters for adding a contact to a customer.
 */
export type TAddContactServiceParams = {
  /** Trusted customer entity attached by existence middleware. */
  customer: Customer;
  /** Validated contact payload. */
  payload: TCreateContactPayload;
};
