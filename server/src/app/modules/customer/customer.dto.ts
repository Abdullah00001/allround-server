import {
  Customer,
  CustomerCategory,
  CustomerContact,
  PhaseStatus,
  Project,
  ProjectPhase,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Customer record including nested contacts.
 */
type TCustomerWithContacts = Customer & {
  contacts: CustomerContact[];
};

/**
 * Project record with the latest phase status selection.
 */
type TProjectWithPhase = Project & {
  phases: Pick<ProjectPhase, 'status'>[];
};

/**
 * Customer detail payload including contacts and linked projects.
 */
type TCustomerDetail = TCustomerWithContacts & {
  projects: TProjectWithPhase[];
};

/**
 * Converts a Prisma Decimal (or null) into a plain number (or null) for API responses.
 *
 * @param {Decimal | null} value - Prisma decimal value.
 * @returns {number | null} Numeric representation, or null when absent.
 */
const decimalToNumber = (value: Decimal | null): number | null => {
  if (value === null) return null;
  return Number(value);
};

/**
 * Sanitized contact person DTO (excludes customerId internals beyond need).
 */
export class CustomerContactDTO {
  /**
   * @param {string} id - Contact UUID.
   * @param {string} name - Contact full name.
   * @param {string} role - Contact role/title.
   * @param {string | null} phone - Optional phone number.
   * @param {string | null} email - Optional email address.
   * @param {boolean} isPrimary - Whether this is the primary contact.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public role: string,
    public phone: string | null,
    public email: string | null,
    public isPrimary: boolean,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a contact DTO from a Prisma `CustomerContact` record.
   *
   * @param {CustomerContact} contact - Prisma contact entity.
   * @returns {CustomerContactDTO} API-safe contact object.
   */
  static build(contact: CustomerContact) {
    return new CustomerContactDTO(
      contact.id,
      contact.name,
      contact.role,
      contact.phone,
      contact.email,
      contact.isPrimary,
      contact.createdAt,
      contact.updatedAt
    );
  }
}

/**
 * Compact linked-project DTO for customer detail views.
 */
export class CustomerProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project site address.
   * @param {Date} createdAt - Project creation timestamp.
   * @param {PhaseStatus | null} currentPhaseStatus - Latest phase status, if any.
   */
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public createdAt: Date,
    public currentPhaseStatus: PhaseStatus | null
  ) {}

  /**
   * Builds a project DTO, deriving `currentPhaseStatus` from the newest phase.
   *
   * @param {TProjectWithPhase} project - Project with ordered phases (take 1).
   * @returns {CustomerProjectDTO} API-safe project summary.
   */
  static build(project: TProjectWithPhase) {
    return new CustomerProjectDTO(
      project.id,
      project.name,
      project.address,
      project.createdAt,
      project.phases[0]?.status ?? null
    );
  }
}

/**
 * List-row customer DTO (no nested contacts/projects; includes contactsCount).
 */
export class CustomerListItemDTO {
  /**
   * @param {string} id - Customer UUID.
   * @param {string} name - Customer name.
   * @param {CustomerCategory} category - CRM category enum.
   * @param {string} address - Customer address.
   * @param {number | null} latitude - Optional latitude.
   * @param {number | null} longitude - Optional longitude.
   * @param {number} contactsCount - Number of linked contacts.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public category: CustomerCategory,
    public address: string,
    public latitude: number | null,
    public longitude: number | null,
    public contactsCount: number,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a list item DTO from a customer plus optional `_count.contacts`.
   *
   * @param {Customer & { _count?: { contacts: number } }} customer - Prisma customer with count.
   * @returns {CustomerListItemDTO} API-safe list row.
   */
  static build(customer: Customer & { _count?: { contacts: number } }) {
    return new CustomerListItemDTO(
      customer.id,
      customer.name,
      customer.category,
      customer.address,
      decimalToNumber(customer.latitude),
      decimalToNumber(customer.longitude),
      customer._count?.contacts ?? 0,
      customer.createdAt,
      customer.updatedAt
    );
  }
}

/**
 * Full customer detail DTO including contacts and linked projects.
 * Intentionally omits `deletedAt`.
 */
export class CustomerDetailDTO {
  /**
   * @param {string} id - Customer UUID.
   * @param {string} name - Customer name.
   * @param {CustomerCategory} category - CRM category enum.
   * @param {string} address - Customer address.
   * @param {number | null} latitude - Optional latitude.
   * @param {number | null} longitude - Optional longitude.
   * @param {CustomerContactDTO[]} contacts - Nested contacts.
   * @param {CustomerProjectDTO[]} projects - Nested non-deleted projects.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public category: CustomerCategory,
    public address: string,
    public latitude: number | null,
    public longitude: number | null,
    public contacts: CustomerContactDTO[],
    public projects: CustomerProjectDTO[],
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a detail DTO from a customer with contacts and projects.
   *
   * @param {TCustomerDetail} customer - Prisma customer graph for detail view.
   * @returns {CustomerDetailDTO} API-safe detail object.
   */
  static build(customer: TCustomerDetail) {
    return new CustomerDetailDTO(
      customer.id,
      customer.name,
      customer.category,
      customer.address,
      decimalToNumber(customer.latitude),
      decimalToNumber(customer.longitude),
      customer.contacts.map(CustomerContactDTO.build),
      customer.projects.map(CustomerProjectDTO.build),
      customer.createdAt,
      customer.updatedAt
    );
  }
}

/**
 * Customer summary DTO used for create/update responses (contacts, no projects).
 * Intentionally omits `deletedAt`.
 */
export class CustomerSummaryDTO {
  /**
   * @param {string} id - Customer UUID.
   * @param {string} name - Customer name.
   * @param {CustomerCategory} category - CRM category enum.
   * @param {string} address - Customer address.
   * @param {number | null} latitude - Optional latitude.
   * @param {number | null} longitude - Optional longitude.
   * @param {CustomerContactDTO[]} contacts - Nested contacts.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public category: CustomerCategory,
    public address: string,
    public latitude: number | null,
    public longitude: number | null,
    public contacts: CustomerContactDTO[],
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a summary DTO from a customer with contacts.
   *
   * @param {TCustomerWithContacts} customer - Prisma customer including contacts.
   * @returns {CustomerSummaryDTO} API-safe summary object.
   */
  static build(customer: TCustomerWithContacts) {
    return new CustomerSummaryDTO(
      customer.id,
      customer.name,
      customer.category,
      customer.address,
      decimalToNumber(customer.latitude),
      decimalToNumber(customer.longitude),
      customer.contacts.map(CustomerContactDTO.build),
      customer.createdAt,
      customer.updatedAt
    );
  }
}
