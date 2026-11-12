import {
  PhaseStatus,
  PhaseType,
  Priority,
  Role,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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
 * Mobile projects-tab row (no admin-only fields).
 */
export class MobileProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   * @param {{ id: string; name: string }} customer - Customer id/name only.
   * @param {MobileProjectPhaseDTO[]} phases - Phases assigned to the user.
   */
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public customer: { id: string; name: string },
    public phases: MobileProjectPhaseDTO[]
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

export { decimalToNumber };
