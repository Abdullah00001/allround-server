import {
  ActivityType,
  PhaseStatus,
  PhaseType,
  Priority,
  Project,
  ProjectPhase,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  TProjectCrewMemberRef,
  TProjectCustomerRef,
} from '@/app/modules/project/project.types';

/**
 * Converts a Prisma Decimal (or null) into a plain number (or null).
 *
 * @param {Decimal | null | undefined} value - Prisma decimal value.
 * @returns {number | null} Numeric representation or null.
 */
const decimalToNumber = (value: Decimal | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

/**
 * Nested customer reference DTO for project responses.
 */
export class ProjectCustomerDTO {
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
   * @param {TProjectCustomerRef} customer - Customer id/name projection.
   * @returns {ProjectCustomerDTO} API-safe customer reference.
   */
  static build(customer: TProjectCustomerRef) {
    return new ProjectCustomerDTO(customer.id, customer.name);
  }
}

/**
 * Nested phase DTO used in list and detail responses.
 */
export class ProjectPhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {string} projectId - Parent project UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Kanban column status.
   * @param {Priority} priority - Phase priority.
   * @param {Date | null} startDate - Optional start date.
   * @param {Date | null} endDate - Optional end date.
   * @param {number | null} durationDays - Optional duration in days.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public projectId: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: Date | null,
    public endDate: Date | null,
    public durationDays: number | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a phase DTO from a Prisma `ProjectPhase`.
   *
   * @param {ProjectPhase} phase - Phase entity.
   * @returns {ProjectPhaseDTO} API-safe phase object.
   */
  static build(phase: ProjectPhase) {
    return new ProjectPhaseDTO(
      phase.id,
      phase.projectId,
      phase.type,
      phase.status,
      phase.priority,
      phase.startDate,
      phase.endDate,
      decimalToNumber(phase.durationDays),
      phase.createdAt,
      phase.updatedAt
    );
  }
}

/**
 * Assigned crew / project-manager member DTO.
 */
export class ProjectCrewMemberDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string} email - User email.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public email: string
  ) {}

  /**
   * Builds a crew member DTO.
   *
   * @param {TProjectCrewMemberRef} user - User projection.
   * @returns {ProjectCrewMemberDTO} API-safe crew member.
   */
  static build(user: TProjectCrewMemberRef) {
    return new ProjectCrewMemberDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.email
    );
  }
}

/**
 * Hours grouped by activity type for project analytics charts.
 */
export class HoursByActivityDTO {
  /**
   * @param {ActivityType} activityType - Time-log activity category.
   * @param {number} hours - Net hours for the activity.
   */
  constructor(
    public activityType: ActivityType,
    public hours: number
  ) {}
}

/**
 * Project list-item DTO with customer name and all phases.
 */
export class ProjectListItemDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   * @param {number} budgetedHours - Budgeted hours.
   * @param {ProjectCustomerDTO} customer - Nested customer.
   * @param {ProjectPhaseDTO[]} phases - All project phases (Kanban).
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public budgetedHours: number,
    public customer: ProjectCustomerDTO,
    public phases: ProjectPhaseDTO[],
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a list-item DTO from Prisma project + relations.
   *
   * @param {Project & { customer: TProjectCustomerRef; phases: ProjectPhase[] }} project - Project row.
   * @returns {ProjectListItemDTO} API-safe list row.
   */
  static build(
    project: Project & {
      customer: TProjectCustomerRef;
      phases: ProjectPhase[];
    }
  ) {
    return new ProjectListItemDTO(
      project.id,
      project.name,
      project.address,
      Number(project.budgetedHours),
      ProjectCustomerDTO.build(project.customer),
      project.phases.map(ProjectPhaseDTO.build),
      project.createdAt,
      project.updatedAt
    );
  }
}

/**
 * Project detail DTO including hour aggregates and assigned crew.
 */
export class ProjectDetailDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} customerId - Linked customer UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   * @param {number | null} latitude - Optional latitude.
   * @param {number | null} longitude - Optional longitude.
   * @param {number} budgetedHours - Budgeted hours.
   * @param {string | null} siteAccessCode - Optional site access code.
   * @param {string | null} siteAccessNotes - Optional site access notes.
   * @param {ProjectCustomerDTO} customer - Nested customer.
   * @param {ProjectPhaseDTO[]} phases - All project phases.
   * @param {number} totalLoggedHours - Net approved logged hours (breaks excluded).
   * @param {HoursByActivityDTO[]} hoursByActivity - Hours grouped by activity type.
   * @param {ProjectCrewMemberDTO[]} assignedCrew - Distinct crew + project managers.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public customerId: string,
    public name: string,
    public address: string,
    public latitude: number | null,
    public longitude: number | null,
    public budgetedHours: number,
    public siteAccessCode: string | null,
    public siteAccessNotes: string | null,
    public customer: ProjectCustomerDTO,
    public phases: ProjectPhaseDTO[],
    public totalLoggedHours: number,
    public hoursByActivity: HoursByActivityDTO[],
    public assignedCrew: ProjectCrewMemberDTO[],
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a detail DTO from project data plus computed aggregates.
   *
   * @param {Project & { customer: TProjectCustomerRef; phases: ProjectPhase[] }} project - Project with relations.
   * @param {number} totalLoggedHours - Aggregated net hours.
   * @param {Array<{ activityType: ActivityType; hours: number }>} hoursByActivity - Activity buckets.
   * @param {TProjectCrewMemberRef[]} assignedCrew - Distinct involved users.
   * @returns {ProjectDetailDTO} API-safe project detail.
   */
  static build(
    project: Project & {
      customer: TProjectCustomerRef;
      phases: ProjectPhase[];
    },
    totalLoggedHours: number,
    hoursByActivity: Array<{ activityType: ActivityType; hours: number }>,
    assignedCrew: TProjectCrewMemberRef[]
  ) {
    return new ProjectDetailDTO(
      project.id,
      project.customerId,
      project.name,
      project.address,
      decimalToNumber(project.latitude),
      decimalToNumber(project.longitude),
      Number(project.budgetedHours),
      project.siteAccessCode,
      project.siteAccessNotes,
      ProjectCustomerDTO.build(project.customer),
      project.phases.map(ProjectPhaseDTO.build),
      totalLoggedHours,
      hoursByActivity.map(
        (row) => new HoursByActivityDTO(row.activityType, row.hours)
      ),
      assignedCrew.map(ProjectCrewMemberDTO.build),
      project.createdAt,
      project.updatedAt
    );
  }
}

/**
 * Lightweight project summary returned after master-data updates.
 */
export class ProjectSummaryDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} customerId - Linked customer UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   * @param {number} budgetedHours - Budgeted hours.
   * @param {string | null} siteAccessCode - Optional site access code.
   * @param {string | null} siteAccessNotes - Optional site access notes.
   * @param {ProjectCustomerDTO} customer - Nested customer.
   * @param {Date} createdAt - Creation timestamp.
   * @param {Date} updatedAt - Last update timestamp.
   */
  constructor(
    public id: string,
    public customerId: string,
    public name: string,
    public address: string,
    public budgetedHours: number,
    public siteAccessCode: string | null,
    public siteAccessNotes: string | null,
    public customer: ProjectCustomerDTO,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  /**
   * Builds a summary DTO from Prisma project + customer.
   *
   * @param {Project & { customer: TProjectCustomerRef }} project - Updated project.
   * @returns {ProjectSummaryDTO} API-safe summary.
   */
  static build(project: Project & { customer: TProjectCustomerRef }) {
    return new ProjectSummaryDTO(
      project.id,
      project.customerId,
      project.name,
      project.address,
      Number(project.budgetedHours),
      project.siteAccessCode,
      project.siteAccessNotes,
      ProjectCustomerDTO.build(project.customer),
      project.createdAt,
      project.updatedAt
    );
  }
}
