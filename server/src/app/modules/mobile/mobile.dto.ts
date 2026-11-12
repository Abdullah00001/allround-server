import {
  ActivityType,
  Inspection,
  InspectionStatus,
  Language,
  LegalContentType,
  PhaseStatus,
  PhaseType,
  Priority,
  Role,
  TimeLog,
  TimeLogBreak,
  TimeLogStatus,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculateNetHours,
  sumBreakMinutes,
} from '@/app/modules/timelog/timelog.helpers';

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
 * Dashboard upcoming-task card.
 */
export class MobileUpcomingTaskDTO {
  /**
   * @param {string} phaseId - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date.
   * @param {string | null} endDate - ISO end date.
   * @param {{ id: string; name: string; address: string }} project - Parent project summary.
   */
  constructor(
    public phaseId: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null,
    public project: { id: string; name: string; address: string }
  ) {}
}

/**
 * Dashboard home stats.
 */
export class MobileDashboardStatsDTO {
  /**
   * @param {number} pendingInspections - Pending inspections assigned to the user.
   * @param {number} assignedProjects - Distinct projects the user is assigned to.
   */
  constructor(
    public pendingInspections: number,
    public assignedProjects: number
  ) {}
}

/**
 * Map pin for the mobile home map.
 */
export class MobileMapPinDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {number | null} latitude - Project latitude.
   * @param {number | null} longitude - Project longitude.
   * @param {PhaseType} activePhaseType - Active phase type for the pin badge.
   */
  constructor(
    public id: string,
    public name: string,
    public latitude: number | null,
    public longitude: number | null,
    public activePhaseType: PhaseType
  ) {}
}

/**
 * Aggregated dashboard response.
 */
export class MobileDashboardDTO {
  /**
   * @param {MobileDashboardStatsDTO} stats - Home screen counters.
   * @param {MobileUpcomingTaskDTO[]} upcomingTasks - Active assigned phases.
   * @param {MobileMapPinDTO[]} mapPins - Distinct project pins with active phases.
   */
  constructor(
    public stats: MobileDashboardStatsDTO,
    public upcomingTasks: MobileUpcomingTaskDTO[],
    public mapPins: MobileMapPinDTO[]
  ) {}
}

/**
 * Compact phase summary for the mobile projects list.
 */
export class MobileProjectPhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date.
   * @param {string | null} endDate - ISO end date.
   */
  constructor(
    public id: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null
  ) {}
}

/**
 * Project shape required by `getProjectDto` (customer + phases + budget).
 */
export type TMobileProjectDtoSource = {
  id: string;
  name: string;
  address: string;
  budgetedHours: Decimal | number;
  customer: { id: string; name: string };
  phases: Array<{
    id: string;
    type: PhaseType;
    status: PhaseStatus;
    priority: Priority;
    startDate: Date | null;
    endDate: Date | null;
  }>;
};

/**
 * Mobile projects-tab / timer-navigation project row.
 * Financial fields are only present for `SITE_MANAGER` via `getProjectDto`.
 */
export class MobileProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   * @param {{ id: string; name: string }} customer - Customer id/name only.
   * @param {MobileProjectPhaseDTO[]} phases - Phases visible to the user.
   * @param {number} [budgetedHours] - Budget hours (site managers only).
   * @param {number} [totalLoggedHours] - Approved logged hours (site managers only).
   * @param {boolean} [isProfitable] - `totalLoggedHours <= budgetedHours` (site managers only).
   */
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public customer: { id: string; name: string },
    public phases: MobileProjectPhaseDTO[],
    public budgetedHours?: number,
    public totalLoggedHours?: number,
    public isProfitable?: boolean
  ) {}
}

/**
 * Builds a role-aware mobile project DTO.
 * Site managers receive budget/logged/profitability fields; employees do not.
 *
 * @param {TMobileProjectDtoSource} project - Project with customer, phases, and budget.
 * @param {Role} userRole - Authenticated user's role.
 * @param {number} totalLoggedHours - Aggregated approved net hours for the project.
 * @returns {MobileProjectDTO} Conditional project DTO for mobile clients.
 */
export const getProjectDto = (
  project: TMobileProjectDtoSource,
  userRole: Role,
  totalLoggedHours: number
): MobileProjectDTO => {
  const phases = project.phases.map(
    (phase) =>
      new MobileProjectPhaseDTO(
        phase.id,
        phase.type,
        phase.status,
        phase.priority,
        phase.startDate ? phase.startDate.toISOString() : null,
        phase.endDate ? phase.endDate.toISOString() : null
      )
  );

  const dto = new MobileProjectDTO(
    project.id,
    project.name,
    project.address,
    { id: project.customer.id, name: project.customer.name },
    phases
  );

  if (userRole === Role.SITE_MANAGER) {
    const budgetedHours = Number(project.budgetedHours);
    dto.budgetedHours = budgetedHours;
    dto.totalLoggedHours = Number(totalLoggedHours.toFixed(2));
    dto.isProfitable = dto.totalLoggedHours <= budgetedHours;
  }

  return dto;
};

/**
 * Wrapper returned by `POST /mobile/timer/start`.
 */
export class MobileStartTimerDTO {
  /**
   * @param {MobileTimeLogDTO} timeLog - Newly opened time log.
   * @param {MobileProjectDTO} project - Role-aware project for navigation/budget UI.
   */
  constructor(
    public timeLog: MobileTimeLogDTO,
    public project: MobileProjectDTO
  ) {}
}

/**
 * Phase card nested under a calendar day group.
 */
export class MobileSchedulePhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string} startDate - ISO start date (non-null for calendar rows).
   * @param {string} endDate - ISO end date (non-null for calendar rows).
   * @param {{ id: string; name: string; address: string }} project - Parent project summary.
   */
  constructor(
    public id: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string,
    public endDate: string,
    public project: { id: string; name: string; address: string }
  ) {}
}

/**
 * Calendar day bucket for the Site Manager schedule tab.
 */
export class MobileScheduleDayDTO {
  /**
   * @param {string} date - UTC calendar date `YYYY-MM-DD`.
   * @param {MobileSchedulePhaseDTO[]} phases - Phases overlapping this date.
   */
  constructor(
    public date: string,
    public phases: MobileSchedulePhaseDTO[]
  ) {}
}

/**
 * Map-tab pin for a project with an active phase.
 */
export class MobileMapProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {number | null} latitude - Project latitude.
   * @param {number | null} longitude - Project longitude.
   * @param {PhaseType} activePhaseType - Active phase type badge.
   */
  constructor(
    public id: string,
    public name: string,
    public latitude: number | null,
    public longitude: number | null,
    public activePhaseType: PhaseType
  ) {}
}

/**
 * Per-activity hour bucket for crew-time aggregates.
 */
export class MobileHoursByActivityDTO {
  /**
   * @param {ActivityType} activityType - Activity category.
   * @param {number} hours - Net hours for the activity.
   */
  constructor(
    public activityType: ActivityType,
    public hours: number
  ) {}
}

/**
 * Per-user crew breakdown row for project crew-time.
 */
export class MobileCrewBreakdownDTO {
  /**
   * @param {{ id: string; firstName: string; lastName: string }} user - Crew member.
   * @param {number} totalHours - Net hours for the member in the filtered window.
   * @param {boolean} synced - `true` when every included log has a `clientSyncId`.
   */
  constructor(
    public user: { id: string; firstName: string; lastName: string },
    public totalHours: number,
    public synced: boolean
  ) {}
}

/**
 * Aggregated project crew-time payload for Site Managers.
 */
export class MobileCrewTimeDTO {
  /**
   * @param {number} totalProjectHours - Sum of net hours in the filtered window.
   * @param {MobileHoursByActivityDTO[]} hoursByActivity - Hours grouped by activity type.
   * @param {MobileCrewBreakdownDTO[]} crewBreakdown - Per-user totals and sync flags.
   * @param {MobileTimeLogDTO[]} logs - Detailed time logs included in the aggregate.
   */
  constructor(
    public totalProjectHours: number,
    public hoursByActivity: MobileHoursByActivityDTO[],
    public crewBreakdown: MobileCrewBreakdownDTO[],
    public logs: MobileTimeLogDTO[]
  ) {}
}

/**
 * Mobile profile tab payload with weekly stats.
 */
export class MobileProfileDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {Role} role - System role.
   * @param {string} email - Email address.
   * @param {string | null} phone - Optional phone.
   * @param {string | null} avatarUrl - Optional avatar URL.
   * @param {number} weeklyHoursTarget - Weekly hours target.
   * @param {number} hoursThisWeek - Net approved hours in the current UTC week.
   * @param {number} assignedProjectsCount - Distinct assigned projects.
   * @param {number} completedProjectsCount - Assigned projects whose phases are all COMPLETED.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public role: Role,
    public email: string,
    public phone: string | null,
    public avatarUrl: string | null,
    public weeklyHoursTarget: number,
    public hoursThisWeek: number,
    public assignedProjectsCount: number,
    public completedProjectsCount: number
  ) {}

  /**
   * Builds a profile DTO from user entity plus computed stats.
   *
   * @param {User} user - Authenticated user.
   * @param {number} hoursThisWeek - Net hours this UTC week.
   * @param {number} assignedProjectsCount - Assigned project count.
   * @param {number} completedProjectsCount - Completed project count.
   * @returns {MobileProfileDTO} API-safe profile payload.
   */
  static build(
    user: User,
    hoursThisWeek: number,
    assignedProjectsCount: number,
    completedProjectsCount: number
  ) {
    return new MobileProfileDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.role,
      user.email,
      user.phone,
      user.avatarUrl,
      Number(user.weeklyHoursTarget),
      hoursThisWeek,
      assignedProjectsCount,
      completedProjectsCount
    );
  }
}

/**
 * Nested user projection for crew-time responses.
 */
export class MobileTimeLogUserDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string
  ) {}

  /**
   * Builds a compact user DTO.
   *
   * @param {Pick<User, 'id' | 'firstName' | 'lastName'>} user - User fields.
   * @returns {MobileTimeLogUserDTO} API-safe user reference.
   */
  static build(user: Pick<User, 'id' | 'firstName' | 'lastName'>) {
    return new MobileTimeLogUserDTO(user.id, user.firstName, user.lastName);
  }
}

/**
 * Mobile time-log DTO with computed net hours.
 */
export class MobileTimeLogDTO {
  /**
   * @param {string} id - Time log UUID.
   * @param {string} phaseId - Phase UUID.
   * @param {ActivityType} activityType - Activity category.
   * @param {string} startTime - ISO start timestamp.
   * @param {string | null} endTime - ISO end timestamp (null while running).
   * @param {boolean} isManual - Whether the entry was manual.
   * @param {TimeLogStatus} status - Approval status.
   * @param {string | null} clientSyncId - Offline sync idempotency key.
   * @param {number} breakMinutes - Total break minutes.
   * @param {number} netHours - Net hours after breaks (0 while open).
   * @param {MobileTimeLogUserDTO | undefined} user - Optional nested user (crew view).
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public phaseId: string,
    public activityType: ActivityType,
    public startTime: string,
    public endTime: string | null,
    public isManual: boolean,
    public status: TimeLogStatus,
    public clientSyncId: string | null,
    public breakMinutes: number,
    public netHours: number,
    public createdAt: string,
    public updatedAt: string,
    public user?: MobileTimeLogUserDTO
  ) {}

  /**
   * Builds a mobile time-log DTO from Prisma data.
   *
   * @param {TimeLog & { breaks: TimeLogBreak[]; user?: Pick<User, 'id' | 'firstName' | 'lastName'> }} timeLog - Time log with breaks.
   * @returns {MobileTimeLogDTO} API-safe time log object.
   */
  static build(
    timeLog: TimeLog & {
      breaks: TimeLogBreak[];
      user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
    }
  ) {
    return new MobileTimeLogDTO(
      timeLog.id,
      timeLog.phaseId,
      timeLog.activityType,
      timeLog.startTime.toISOString(),
      timeLog.endTime ? timeLog.endTime.toISOString() : null,
      timeLog.isManual,
      timeLog.status,
      timeLog.clientSyncId,
      Number(sumBreakMinutes(timeLog.breaks).toFixed(2)),
      calculateNetHours(timeLog),
      timeLog.createdAt.toISOString(),
      timeLog.updatedAt.toISOString(),
      timeLog.user ? MobileTimeLogUserDTO.build(timeLog.user) : undefined
    );
  }
}

/**
 * Result DTO for offline sync.
 */
export class MobileSyncResultDTO {
  /**
   * @param {number} created - Newly inserted log count.
   * @param {number} skipped - Idempotent skip count (existing clientSyncId).
   * @param {MobileTimeLogDTO[]} logs - Created log DTOs only.
   */
  constructor(
    public created: number,
    public skipped: number,
    public logs: MobileTimeLogDTO[]
  ) {}
}

/**
 * Mobile inspection DTO for Site Manager survey flows (no admin-only extras).
 */
export class MobileInspectionDTO {
  /**
   * @param {string} id - Inspection UUID.
   * @param {string} siteTitle - Site title.
   * @param {string} address - Site address.
   * @param {string | null} postalCode - Optional postal code.
   * @param {string | null} city - Optional city.
   * @param {string} appointmentDate - ISO appointment timestamp.
   * @param {number | null} scaffoldArea - Scaffold area.
   * @param {number | null} scaffoldHeight - Scaffold height.
   * @param {string | null} scaffoldType - Scaffold type.
   * @param {InspectionStatus} status - Inspection status.
   * @param {{ id: string; name: string }} customer - Customer id/name.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public siteTitle: string,
    public address: string,
    public postalCode: string | null,
    public city: string | null,
    public appointmentDate: string,
    public scaffoldArea: number | null,
    public scaffoldHeight: number | null,
    public scaffoldType: string | null,
    public status: InspectionStatus,
    public customer: { id: string; name: string },
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a mobile inspection DTO.
   *
   * @param {Inspection & { customer: { id: string; name: string } }} inspection - Inspection with customer.
   * @returns {MobileInspectionDTO} API-safe inspection object.
   */
  static build(
    inspection: Inspection & { customer: { id: string; name: string } }
  ) {
    return new MobileInspectionDTO(
      inspection.id,
      inspection.siteTitle,
      inspection.address,
      inspection.postalCode,
      inspection.city,
      inspection.appointmentDate.toISOString(),
      decimalToNumber(inspection.scaffoldArea),
      decimalToNumber(inspection.scaffoldHeight),
      inspection.scaffoldType,
      inspection.status,
      { id: inspection.customer.id, name: inspection.customer.name },
      inspection.createdAt.toISOString(),
      inspection.updatedAt.toISOString()
    );
  }
}

/**
 * Mobile phase-board row for Site Managers.
 */
export class MobileManagedPhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date.
   * @param {string | null} endDate - ISO end date.
   * @param {{ id: string; name: string; address: string }} project - Parent project summary.
   */
  constructor(
    public id: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null,
    public project: { id: string; name: string; address: string }
  ) {}
}

/**
 * Legal content row for the mobile Legal Information screen.
 */
export class MobileLegalContentDTO {
  /**
   * @param {LegalContentType} legalContentType - Content category.
   * @param {string} content - HTML/text body.
   * @param {string} updatedAt - ISO last-updated timestamp.
   */
  constructor(
    public legalContentType: LegalContentType,
    public content: string,
    public updatedAt: string
  ) {}
}

/**
 * Mobile app configuration from company settings + legal content.
 */
export class MobileConfigDTO {
  /**
   * @param {Language} defaultLanguage - Company default language.
   * @param {Language[]} enabledLanguages - Languages enabled for the mobile UI.
   * @param {boolean} allowEmployeeManualTime - Whether employees may submit manual time.
   * @param {MobileLegalContentDTO[]} legalContents - Published legal documents.
   */
  constructor(
    public defaultLanguage: Language,
    public enabledLanguages: Language[],
    public allowEmployeeManualTime: boolean,
    public legalContents: MobileLegalContentDTO[]
  ) {}
}

export { decimalToNumber };
