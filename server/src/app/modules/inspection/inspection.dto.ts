import {
  Inspection,
  InspectionStatus,
  PhaseType,
  Project,
  ProjectMeasurement,
  ProjectPhase,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  TInspectionCustomerRef,
  TInspectionSiteManagerRef,
} from '@/app/modules/inspection/inspection.types';

/**
 * Converts a Prisma Decimal (or null) into a plain number (or null).
 *
 * @param {Decimal | null} value - Prisma decimal value.
 * @returns {number | null} Numeric representation or null.
 */
const decimalToNumber = (value: Decimal | null): number | null => {
  if (value === null) return null;
  return Number(value);
};

/**
 * Nested customer reference DTO for inspection responses.
 */
export class InspectionCustomerDTO {
  /**
   * @param {string} id - Customer UUID.
   * @param {string} name - Customer display name.
   */
  constructor(
    public id: string,
    public name: string
  ) {}

  /**
   * Builds a customer ref DTO.
   *
   * @param {TInspectionCustomerRef} customer - Customer id/name projection.
   * @returns {InspectionCustomerDTO} API-safe customer reference.
   */
  static build(customer: TInspectionCustomerRef) {
    return new InspectionCustomerDTO(customer.id, customer.name);
  }
}

/**
 * Nested site-manager reference DTO for inspection responses.
 */
export class InspectionSiteManagerDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - Site manager first name.
   * @param {string} lastName - Site manager last name.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string
  ) {}

  /**
   * Builds a site-manager ref DTO.
   *
   * @param {TInspectionSiteManagerRef} user - User name projection.
   * @returns {InspectionSiteManagerDTO} API-safe site manager reference.
   */
  static build(user: TInspectionSiteManagerRef) {
    return new InspectionSiteManagerDTO(
      user.id,
      user.firstName,
      user.lastName
    );
  }
}

/**
 * Standard inspection response DTO (list and detail).
 * Omits `deletedAt`.
 */
export class InspectionDTO {
  /**
   * @param {string} id - Inspection UUID.
   * @param {string} customerId - Linked customer UUID.
   * @param {string | null} siteManagerId - Optional site manager UUID.
   * @param {string} siteTitle - Inspection site title.
   * @param {string} address - Site address.
   * @param {string | null} postalCode - Optional postal code.
   * @param {string | null} city - Optional city.
   * @param {Date} appointmentDate - Scheduled appointment.
   * @param {number | null} scaffoldArea - Optional scaffold area.
   * @param {number | null} scaffoldHeight - Optional scaffold height.
   * @param {string | null} scaffoldType - Optional scaffold type.
   * @param {InspectionStatus} status - Workflow status.
   * @param {InspectionCustomerDTO} customer - Nested customer.
   * @param {InspectionSiteManagerDTO | null} siteManager - Nested site manager.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public customerId: string,
    public siteManagerId: string | null,
    public siteTitle: string,
    public address: string,
    public postalCode: string | null,
    public city: string | null,
    public appointmentDate: Date,
    public scaffoldArea: number | null,
    public scaffoldHeight: number | null,
    public scaffoldType: string | null,
    public status: InspectionStatus,
    public customer: InspectionCustomerDTO,
    public siteManager: InspectionSiteManagerDTO | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds an inspection DTO from Prisma data plus optional site manager.
   *
   * @param {Inspection & { customer: TInspectionCustomerRef }} inspection - Inspection with customer.
   * @param {TInspectionSiteManagerRef | null} siteManager - Optional site manager user.
   * @returns {InspectionDTO} API-safe inspection object.
   */
  static build(
    inspection: Inspection & { customer: TInspectionCustomerRef },
    siteManager: TInspectionSiteManagerRef | null
  ) {
    return new InspectionDTO(
      inspection.id,
      inspection.customerId,
      inspection.siteManagerId,
      inspection.siteTitle,
      inspection.address,
      inspection.postalCode,
      inspection.city,
      inspection.appointmentDate,
      decimalToNumber(inspection.scaffoldArea),
      decimalToNumber(inspection.scaffoldHeight),
      inspection.scaffoldType,
      inspection.status,
      InspectionCustomerDTO.build(inspection.customer),
      siteManager ? InspectionSiteManagerDTO.build(siteManager) : null,
      inspection.createdAt,
      inspection.updatedAt
    );
  }
}

/**
 * Result DTO for converting an inspection into a project.
 */
export class ConvertInspectionDTO {
  /**
   * @param {InspectionDTO} inspection - Updated inspection (status CONVERTED).
   * @param {{ id: string; name: string; address: string }} project - Created project summary.
   * @param {{ id: string; type: PhaseType; status: string }} phase - Initial project phase.
   * @param {{ id: string; area: number; height: number; scaffoldType: string | null } | null} measurement - Optional measurement.
   */
  constructor(
    public inspection: InspectionDTO,
    public project: { id: string; name: string; address: string },
    public phase: { id: string; type: PhaseType; status: string },
    public measurement: {
      id: string;
      area: number;
      height: number;
      scaffoldType: string | null;
    } | null
  ) {}

  /**
   * Builds the convert response DTO.
   *
   * @param {InspectionDTO} inspection - Converted inspection DTO.
   * @param {Project} project - Created project entity.
   * @param {ProjectPhase} phase - Created initial phase.
   * @param {ProjectMeasurement | null} measurement - Created measurement, if any.
   * @returns {ConvertInspectionDTO} Convert API payload.
   */
  static build(
    inspection: InspectionDTO,
    project: Project,
    phase: ProjectPhase,
    measurement: ProjectMeasurement | null
  ) {
    return new ConvertInspectionDTO(
      inspection,
      {
        id: project.id,
        name: project.name,
        address: project.address,
      },
      {
        id: phase.id,
        type: phase.type,
        status: phase.status,
      },
      measurement
        ? {
            id: measurement.id,
            area: Number(measurement.area),
            height: Number(measurement.height),
            scaffoldType: measurement.scaffoldType,
          }
        : null
    );
  }
}
