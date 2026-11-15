import {
  Attachment,
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
 * Inspection PHOTO attachment (parity with mobile survey storage).
 */
export class InspectionPhotoDTO {
  /**
   * @param {string} id - Attachment UUID.
   * @param {string} url - Public media URL.
   * @param {string} fileType - MIME or file type string.
   * @param {string | null} fileName - Optional original file name.
   */
  constructor(
    public id: string,
    public url: string,
    public fileType: string,
    public fileName: string | null
  ) {}

  /**
   * Builds a photo DTO from an Attachment row.
   *
   * @param {Pick<Attachment, 'id' | 'url' | 'fileType' | 'fileName'>} attachment - Photo attachment.
   * @returns {InspectionPhotoDTO} API-safe photo reference.
   */
  static build(
    attachment: Pick<Attachment, 'id' | 'url' | 'fileType' | 'fileName'>
  ) {
    return new InspectionPhotoDTO(
      attachment.id,
      attachment.url,
      attachment.fileType,
      attachment.fileName
    );
  }
}

/**
 * KPI cards for the Site Inspections list screen.
 */
export class InspectionListStatsDTO {
  /**
   * @param {number} totalInspections - Non-deleted inspections (search-scoped).
   * @param {number} totalSpecsArea - Sum of non-null scaffoldArea.
   * @param {number | null} avgScaffoldHeight - Average non-null scaffoldHeight.
   * @param {number} awaitingSurvey - PENDING count.
   * @param {number} surveysCompleted - SURVEY_DONE count.
   */
  constructor(
    public totalInspections: number,
    public totalSpecsArea: number,
    public avgScaffoldHeight: number | null,
    public awaitingSurvey: number,
    public surveysCompleted: number
  ) {}
}

/**
 * Tab badge counts for the inspections list.
 */
export class InspectionTabCountsDTO {
  /**
   * @param {number} all - All non-deleted (search-scoped).
   * @param {number} pending - PENDING (Awaiting Survey).
   * @param {number} surveyDone - SURVEY_DONE.
   * @param {number} converted - CONVERTED.
   */
  constructor(
    public all: number,
    public pending: number,
    public surveyDone: number,
    public converted: number
  ) {}
}

/**
 * Standard inspection response DTO (list and detail).
 * Includes survey notes, projectId, and photos for admin↔mobile parity.
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
   * @param {string | null} siteAccessInstructions - Survey / access notes (mobile parity).
   * @param {string | null} specialRequirements - Specs notes / obstacles (mobile parity).
   * @param {InspectionStatus} status - Workflow status.
   * @param {string | null} projectId - Linked project after convert.
   * @param {InspectionCustomerDTO} customer - Nested customer.
   * @param {InspectionSiteManagerDTO | null} siteManager - Nested site manager.
   * @param {InspectionPhotoDTO[]} photos - PHOTO attachments.
   * @param {number} photoCount - Total PHOTO count.
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
    public siteAccessInstructions: string | null,
    public specialRequirements: string | null,
    public status: InspectionStatus,
    public projectId: string | null,
    public customer: InspectionCustomerDTO,
    public siteManager: InspectionSiteManagerDTO | null,
    public photos: InspectionPhotoDTO[],
    public photoCount: number,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds an inspection DTO from Prisma data plus optional site manager and photos.
   *
   * @param {Inspection & { customer: TInspectionCustomerRef; attachments?: Array<Pick<Attachment, 'id' | 'url' | 'fileType' | 'fileName'>>; _count?: { attachments: number } }} inspection - Inspection with customer and photos.
   * @param {TInspectionSiteManagerRef | null} siteManager - Optional site manager user.
   * @returns {InspectionDTO} API-safe inspection object.
   */
  static build(
    inspection: Inspection & {
      customer: TInspectionCustomerRef;
      attachments?: Array<
        Pick<Attachment, 'id' | 'url' | 'fileType' | 'fileName'>
      >;
      _count?: { attachments: number };
    },
    siteManager: TInspectionSiteManagerRef | null
  ) {
    const photos = (inspection.attachments ?? []).map(InspectionPhotoDTO.build);
    const photoCount = inspection._count?.attachments ?? photos.length;

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
      inspection.siteAccessInstructions,
      inspection.specialRequirements,
      inspection.status,
      inspection.projectId,
      InspectionCustomerDTO.build(inspection.customer),
      siteManager ? InspectionSiteManagerDTO.build(siteManager) : null,
      photos,
      photoCount,
      inspection.createdAt,
      inspection.updatedAt
    );
  }
}

/**
 * Paginated list payload with KPI stats and tab counts.
 */
export class InspectionListDTO {
  /**
   * @param {InspectionDTO[]} items - Page of inspections.
   * @param {InspectionListStatsDTO} stats - KPI cards.
   * @param {InspectionTabCountsDTO} tabCounts - Tab badges.
   */
  constructor(
    public items: InspectionDTO[],
    public stats: InspectionListStatsDTO,
    public tabCounts: InspectionTabCountsDTO
  ) {}
}

/**
 * Result DTO for converting an inspection into a project.
 * Includes client name and flat specs for the admin success modal.
 */
export class ConvertInspectionDTO {
  /**
   * @param {InspectionDTO} inspection - Updated inspection (status CONVERTED).
   * @param {{ id: string; name: string; address: string; client: { id: string; name: string }; scaffoldArea: number | null; specs: { area: number | null; height: number | null; scaffoldType: string | null } }} project - Created project summary.
   * @param {{ id: string; type: PhaseType; status: string }} phase - Initial project phase.
   * @param {{ id: string; area: number; height: number; scaffoldType: string | null } | null} measurement - Optional measurement.
   */
  constructor(
    public inspection: InspectionDTO,
    public project: {
      id: string;
      name: string;
      address: string;
      client: { id: string; name: string };
      scaffoldArea: number | null;
      specs: {
        area: number | null;
        height: number | null;
        scaffoldType: string | null;
      };
    },
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
   * @param {{ id: string; name: string }} client - Customer summary.
   * @param {ProjectPhase} phase - Created initial phase.
   * @param {ProjectMeasurement | null} measurement - Created measurement, if any.
   * @returns {ConvertInspectionDTO} Convert API payload.
   */
  static build(
    inspection: InspectionDTO,
    project: Project,
    client: { id: string; name: string },
    phase: ProjectPhase,
    measurement: ProjectMeasurement | null
  ) {
    const area = decimalToNumber(project.scaffoldArea);
    return new ConvertInspectionDTO(
      inspection,
      {
        id: project.id,
        name: project.name,
        address: project.address,
        client,
        scaffoldArea: area,
        specs: {
          area,
          height: measurement ? Number(measurement.height) : null,
          scaffoldType: measurement?.scaffoldType ?? null,
        },
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
