import { Prisma } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  CustomerContactDTO,
  CustomerDetailDTO,
  CustomerListItemDTO,
  CustomerSummaryDTO,
} from '@/app/modules/customer/customer.dto';
import {
  TAddContactServiceParams,
  TCreateCustomerServiceParams,
  TGetCustomerByIdServiceParams,
  TListCustomersServiceParams,
  TUpdateCustomerServiceParams,
} from '@/app/modules/customer/customer.types';

/**
 * Creates a customer and optional nested contacts inside a Prisma transaction.
 * If a primary contact is present, demotes all other contacts for that customer.
 *
 * @param {TCreateCustomerServiceParams} params - Validated create payload wrapper.
 * @param {TCreateCustomerPayload} params.payload - Customer fields and optional contacts.
 * @returns {Promise<CustomerSummaryDTO>} Created customer with contacts.
 */
export const createCustomerService = async ({
  payload,
}: TCreateCustomerServiceParams): Promise<CustomerSummaryDTO> => {
  const { contacts, latitude, longitude, ...customerData } = payload;

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        ...customerData,
        latitude:
          latitude === undefined ? undefined : new Prisma.Decimal(latitude),
        longitude:
          longitude === undefined ? undefined : new Prisma.Decimal(longitude),
        contacts: contacts?.length
          ? {
              create: contacts.map((contact) => ({
                name: contact.name,
                role: contact.role,
                phone: contact.phone,
                email: contact.email,
                isPrimary: contact.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: { contacts: true },
    });

    const primary = created.contacts.find((c) => c.isPrimary);
    if (primary) {
      await tx.customerContact.updateMany({
        where: {
          customerId: created.id,
          id: { not: primary.id },
        },
        data: { isPrimary: false },
      });
    }

    return tx.customer.findUniqueOrThrow({
      where: { id: created.id },
      include: { contacts: { orderBy: { createdAt: 'asc' } } },
    });
  });

  return CustomerSummaryDTO.build(customer);
};

/**
 * Lists non-deleted customers with optional search/category filters and pagination.
 *
 * @param {TListCustomersServiceParams} params - Validated query wrapper.
 * @param {TGetCustomersQuery} params.query - Page, limit, search, and category filters.
 * @returns {Promise<{ items: CustomerListItemDTO[]; total: number; page: number; limit: number }>}
 * Paginated list rows plus total count for meta construction.
 */
export const listCustomersService = async ({
  query,
}: TListCustomersServiceParams): Promise<{
  items: CustomerListItemDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, search, category } = query;
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true } },
      },
    }),
  ]);

  return {
    items: customers.map(CustomerListItemDTO.build),
    total,
    page,
    limit,
  };
};

/**
 * Loads customer detail including contacts and non-deleted projects.
 * Assumes the customer id was already verified by existence middleware.
 *
 * @param {TGetCustomerByIdServiceParams} params - Trusted customer id wrapper.
 * @param {string} params.customerId - Existing non-deleted customer UUID.
 * @returns {Promise<CustomerDetailDTO>} Detail DTO with contacts and projects.
 */
export const getCustomerByIdService = async ({
  customerId,
}: TGetCustomerByIdServiceParams): Promise<CustomerDetailDTO> => {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          phases: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

  return CustomerDetailDTO.build(customer);
};

/**
 * Updates an existing non-deleted customer.
 * Assumes existence middleware already verified the customer.
 *
 * @param {TUpdateCustomerServiceParams} params - Trusted customer and payload.
 * @param {Customer} params.customer - Existing customer from `req.customer`.
 * @param {TUpdateCustomerPayload} params.payload - Partial update fields.
 * @returns {Promise<CustomerSummaryDTO>} Updated customer with contacts.
 */
export const updateCustomerService = async ({
  customer,
  payload,
}: TUpdateCustomerServiceParams): Promise<CustomerSummaryDTO> => {
  const { latitude, longitude, ...rest } = payload;
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...rest,
      ...(latitude !== undefined
        ? {
            latitude: latitude === null ? null : new Prisma.Decimal(latitude),
          }
        : {}),
      ...(longitude !== undefined
        ? {
            longitude:
              longitude === null ? null : new Prisma.Decimal(longitude),
          }
        : {}),
    },
    include: { contacts: { orderBy: { createdAt: 'asc' } } },
  });

  return CustomerSummaryDTO.build(updated);
};

/**
 * Adds a contact to an existing customer.
 * When `isPrimary` is true, demotes all other contacts in the same transaction.
 *
 * @param {TAddContactServiceParams} params - Trusted customer and contact payload.
 * @param {Customer} params.customer - Existing customer from `req.customer`.
 * @param {TCreateContactPayload} params.payload - Validated contact fields.
 * @returns {Promise<CustomerContactDTO>} Newly created contact DTO.
 */
export const addCustomerContactService = async ({
  customer,
  payload,
}: TAddContactServiceParams): Promise<CustomerContactDTO> => {
  const contact = await prisma.$transaction(async (tx) => {
    if (payload.isPrimary) {
      await tx.customerContact.updateMany({
        where: { customerId: customer.id },
        data: { isPrimary: false },
      });
    }

    return tx.customerContact.create({
      data: {
        customerId: customer.id,
        name: payload.name,
        role: payload.role,
        phone: payload.phone,
        email: payload.email,
        isPrimary: payload.isPrimary ?? false,
      },
    });
  });

  return CustomerContactDTO.build(contact);
};
