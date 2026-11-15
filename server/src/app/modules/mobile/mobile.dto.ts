import {
  ActivityType,
  Attachment,
  AttachmentCategory,
  CustomerCategory,
  Inspection,
  InspectionStatus,
  Language,
  LegalContentType,
  MeasurementUnit,
  PhaseStatus,
  PhaseType,
  Priority,
  Project,
  ProjectMeasurement,
  ProjectNote,
  ProjectNoteCategory,
  ProjectPhase,
  ProjectTask,
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
 * Planned vs running counts for one phase type on the home dashboard.
 */
export class MobilePhaseTypeStatsDTO {
  /**
   * @param {number} planned - Phases scheduled but not yet `IN_PROGRESS`.
   * @param {number} running - Phases with status `IN_PROGRESS`.
   */
  constructor(
    public planned: number,
    public running: number
  ) {}
}

/**
 * Dashboard home stats.
 */
export class MobileDashboardStatsDTO {
  /**
   * @param {number} pendingInspections - Pending inspections assigned to the user.
   * @param {number} assignedProjects - Distinct projects the user is assigned to.
   * @param {number} standingActiveSites - Distinct projects with an active STANDING phase.
   * @param {MobilePhaseTypeStatsDTO} erection - Planned/running ERECTION counts.
   * @param {MobilePhaseTypeStatsDTO} dismantling - Planned/running DISMANTLING counts.
   */
  constructor(
    public pendingInspections: number,
    public assignedProjects: number,
    public standingActiveSites: number,
    public erection: MobilePhaseTypeStatsDTO,
    public dismantling: MobilePhaseTypeStatsDTO
  ) {}
}

/**
 * Phase-centric project list card (one row per phase).
 */
export class MobileProjectPhaseCardDTO {
  /**
   * @param {string} phaseId - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date.
   * @param {string | null} endDate - ISO end date.
   * @param {number | null} durationDays - Phase duration in days.
   * @param {string} projectId - Parent project UUID.
   * @param {string} projectName - Project name.
   * @param {{ lat: number; lng: number } | null} coordinates - Project geo coordinates.
   * @param {{ id: string; name: string; category: CustomerCategory }} customer - Customer summary.
   * @param {string | null} assigneeName - Primary project manager display name.
   * @param {number} [budgetedHours] - Budget hours (site managers only).
   * @param {number} [totalLoggedHours] - Approved logged hours (site managers only).
   * @param {boolean} [isProfitable] - Logged hours within budget (site managers only).
   */
  constructor(
    public phaseId: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null,
    public durationDays: number | null,
    public projectId: string,
    public projectName: string,
    public coordinates: { lat: number; lng: number } | null,
    public customer: { id: string; name: string; category: CustomerCategory },
    public assigneeName: string | null,
    public budgetedHours?: number,
    public totalLoggedHours?: number,
    public isProfitable?: boolean
  ) {}
}

/**
 * Map pin for the mobile home map.
 */
export class MobileMapPinDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {{ lat: number; lng: number } | null} coordinates - Project geo coordinates.
   * @param {PhaseType} activePhaseType - Active phase type for the pin badge.
   */
  constructor(
    public id: string,
    public name: string,
    public coordinates: { lat: number; lng: number } | null,
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
   * @param {{ lat: number; lng: number } | null} coordinates - Project geo coordinates.
   * @param {PhaseType} activePhaseType - Active phase type badge.
   */
  constructor(
    public id: string,
    public name: string,
    public coordinates: { lat: number; lng: number } | null,
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
   * @param {string | null} siteAccessInstructions - Site access notes from survey.
   * @param {string | null} specialRequirements - Special requirements from survey.
   * @param {InspectionStatus} status - Inspection status.
   * @param {string | null} projectId - Linked project after convert.
   * @param {{ id: string; name: string; category?: CustomerCategory }} customer - Customer summary.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   * @param {{ id: string; name: string } | undefined} [convertedProject] - Project created when convertToProject ran.
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
    public siteAccessInstructions: string | null,
    public specialRequirements: string | null,
    public status: InspectionStatus,
    public projectId: string | null,
    public customer: { id: string; name: string; category?: CustomerCategory },
    public createdAt: string,
    public updatedAt: string,
    public convertedProject?: { id: string; name: string }
  ) {}

  /**
   * Builds a mobile inspection DTO.
   *
   * @param {Inspection & { customer: { id: string; name: string; category?: CustomerCategory } }} inspection - Inspection with customer.
   * @param {{ id: string; name: string } | undefined} [convertedProject] - Optional converted project summary.
   * @returns {MobileInspectionDTO} API-safe inspection object.
   */
  static build(
    inspection: Inspection & {
      customer: { id: string; name: string; category?: CustomerCategory };
    },
    convertedProject?: { id: string; name: string }
  ) {
    const linkedProject =
      convertedProject ??
      (inspection.projectId
        ? { id: inspection.projectId, name: inspection.siteTitle }
        : undefined);

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
      inspection.siteAccessInstructions ?? null,
      inspection.specialRequirements ?? null,
      inspection.status,
      inspection.projectId ?? null,
      {
        id: inspection.customer.id,
        name: inspection.customer.name,
        ...(inspection.customer.category
          ? { category: inspection.customer.category }
          : {}),
      },
      inspection.createdAt.toISOString(),
      inspection.updatedAt.toISOString(),
      linkedProject
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

/**
 * Compact employee projection for task assignee rows.
 */
export class MobileTaskEmployeeDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string | null} avatarUrl - Optional avatar.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null
  ) {}

  /**
   * Builds an assignee DTO.
   *
   * @param {Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>} user - User fields.
   * @returns {MobileTaskEmployeeDTO} Assignee projection.
   */
  static build(
    user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  ): MobileTaskEmployeeDTO {
    return new MobileTaskEmployeeDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.avatarUrl
    );
  }
}

/**
 * Project task row for open/completed lists.
 */
export class MobileProjectTaskDTO {
  /**
   * @param {string} id - Task UUID.
   * @param {string} projectId - Parent project UUID.
   * @param {string} title - Task title.
   * @param {string | null} description - Task description.
   * @param {Priority} priority - Task priority.
   * @param {boolean} isCompleted - Completion flag.
   * @param {string | null} dueDate - ISO due date.
   * @param {MobileTaskEmployeeDTO | null} employee - Assigned employee.
   * @param {string} createdAt - ISO created timestamp.
   * @param {string} updatedAt - ISO updated timestamp.
   */
  constructor(
    public id: string,
    public projectId: string,
    public title: string,
    public description: string | null,
    public priority: Priority,
    public isCompleted: boolean,
    public dueDate: string | null,
    public employee: MobileTaskEmployeeDTO | null,
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a task DTO from Prisma data.
   *
   * @param {ProjectTask & { employee: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> | null }} task - Task with assignee.
   * @returns {MobileProjectTaskDTO} API-safe task object.
   */
  static build(
    task: ProjectTask & {
      employee: Pick<
        User,
        'id' | 'firstName' | 'lastName' | 'avatarUrl'
      > | null;
    }
  ): MobileProjectTaskDTO {
    return new MobileProjectTaskDTO(
      task.id,
      task.projectId,
      task.title,
      task.description,
      task.priority,
      task.isCompleted,
      task.dueDate ? task.dueDate.toISOString() : null,
      task.employee ? MobileTaskEmployeeDTO.build(task.employee) : null,
      task.createdAt.toISOString(),
      task.updatedAt.toISOString()
    );
  }
}

/**
 * Open + completed task lists for a project.
 */
export class MobileProjectTasksListDTO {
  /**
   * @param {MobileProjectTaskDTO[]} open - Incomplete tasks.
   * @param {MobileProjectTaskDTO[]} completed - Completed tasks.
   */
  constructor(
    public open: MobileProjectTaskDTO[],
    public completed: MobileProjectTaskDTO[]
  ) {}
}

/**
 * Measurement list wrapper with total calculated area.
 */
export class MobileMeasurementsListDTO {
  /**
   * @param {MobileMeasurementDTO[]} items - Measurement line items.
   * @param {number} totalArea - Sum of line-item areas (matches Project.scaffoldArea when in sync).
   */
  constructor(
    public items: MobileMeasurementDTO[],
    public totalArea: number
  ) {}
}

/**
 * Measurement line-item DTO.
 */
export class MobileMeasurementDTO {
  /**
   * @param {string} id - Measurement UUID.
   * @param {string} projectId - Parent project UUID.
   * @param {string | null} position - Optional position label.
   * @param {number} length - Length value.
   * @param {number} height - Height value.
   * @param {number} quantity - Quantity multiplier.
   * @param {MeasurementUnit} unit - Unit enum.
   * @param {string | null} remark - Optional remark.
   * @param {number} area - Computed area (`length * height * quantity`).
   * @param {string | null} scaffoldType - Optional scaffold type.
   * @param {string} createdAt - ISO created timestamp.
   */
  constructor(
    public id: string,
    public projectId: string,
    public position: string | null,
    public length: number,
    public height: number,
    public quantity: number,
    public unit: MeasurementUnit,
    public remark: string | null,
    public area: number,
    public scaffoldType: string | null,
    public createdAt: string
  ) {}

  /**
   * Builds a measurement DTO.
   *
   * @param {ProjectMeasurement} measurement - Prisma measurement row.
   * @returns {MobileMeasurementDTO} API-safe measurement object.
   */
  static build(measurement: ProjectMeasurement): MobileMeasurementDTO {
    return new MobileMeasurementDTO(
      measurement.id,
      measurement.projectId,
      measurement.position,
      Number(measurement.length),
      Number(measurement.height),
      Number(measurement.quantity),
      measurement.unit,
      measurement.remark,
      Number(measurement.area),
      measurement.scaffoldType,
      measurement.createdAt.toISOString()
    );
  }
}

/**
 * Project note DTO with author projection.
 */
export class MobileProjectNoteDTO {
  /**
   * @param {string} id - Note UUID.
   * @param {string} projectId - Parent project UUID.
   * @param {ProjectNoteCategory} category - Note category.
   * @param {string} content - Note body.
   * @param {{ id: string; firstName: string; lastName: string }} author - Author projection.
   * @param {string} createdAt - ISO created timestamp.
   */
  constructor(
    public id: string,
    public projectId: string,
    public category: ProjectNoteCategory,
    public content: string,
    public author: { id: string; firstName: string; lastName: string },
    public createdAt: string
  ) {}

  /**
   * Builds a note DTO.
   *
   * @param {ProjectNote & { author: Pick<User, 'id' | 'firstName' | 'lastName'> }} note - Note with author.
   * @returns {MobileProjectNoteDTO} API-safe note object.
   */
  static build(
    note: ProjectNote & {
      author: Pick<User, 'id' | 'firstName' | 'lastName'>;
    }
  ): MobileProjectNoteDTO {
    return new MobileProjectNoteDTO(
      note.id,
      note.projectId,
      note.category,
      note.content,
      {
        id: note.author.id,
        firstName: note.author.firstName,
        lastName: note.author.lastName,
      },
      note.createdAt.toISOString()
    );
  }
}

/**
 * Phase dates DTO including safety inspection flag.
 */
export class MobilePhaseDatesDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {string} projectId - Parent project UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date.
   * @param {string | null} endDate - ISO end date.
   * @param {number | null} durationDays - Duration in days.
   * @param {boolean} safetyInspectionComplete - Safety inspection flag.
   */
  constructor(
    public id: string,
    public projectId: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null,
    public durationDays: number | null,
    public safetyInspectionComplete: boolean
  ) {}

  /**
   * Builds a phase-dates DTO.
   *
   * @param {ProjectPhase} phase - Prisma phase row.
   * @returns {MobilePhaseDatesDTO} API-safe phase dates object.
   */
  static build(phase: ProjectPhase): MobilePhaseDatesDTO {
    return new MobilePhaseDatesDTO(
      phase.id,
      phase.projectId,
      phase.type,
      phase.status,
      phase.priority,
      phase.startDate ? phase.startDate.toISOString() : null,
      phase.endDate ? phase.endDate.toISOString() : null,
      decimalToNumber(phase.durationDays),
      phase.safetyInspectionComplete
    );
  }
}
/**
 * Project settings DTO after elaborate patch (excludes customer + redundant contacts).
 * Contact info comes from `customer.primaryContact` on detail; location from `coordinates`.
 */
export class MobileProjectSettingsDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {{ lat: number; lng: number } | null} coordinates - Geo coordinates.
   * @param {number} budgetedHours - Labor budget hours.
   * @param {number | null} scaffoldArea - Aggregated scaffold area.
   * @param {string | null} siteAccessCode - Gate / access code.
   * @param {string | null} siteAccessNotes - Access notes.
   * @param {MobilePhaseDatesDTO[]} phases - Project phases with dates/safety.
   */
  constructor(
    public id: string,
    public name: string,
    public coordinates: { lat: number; lng: number } | null,
    public budgetedHours: number,
    public scaffoldArea: number | null,
    public siteAccessCode: string | null,
    public siteAccessNotes: string | null,
    public phases: MobilePhaseDatesDTO[]
  ) {}

  /**
   * Builds settings DTO from project + phases.
   *
   * @param {Project & { phases: ProjectPhase[] }} project - Project with phases.
   * @returns {MobileProjectSettingsDTO} Settings projection.
   */
  static build(
    project: Project & { phases: ProjectPhase[] }
  ): MobileProjectSettingsDTO {
    const lat = decimalToNumber(project.latitude);
    const lng = decimalToNumber(project.longitude);
    return new MobileProjectSettingsDTO(
      project.id,
      project.name,
      lat !== null && lng !== null ? { lat, lng } : null,
      Number(project.budgetedHours),
      decimalToNumber(project.scaffoldArea),
      project.siteAccessCode,
      project.siteAccessNotes,
      project.phases.map((phase) => MobilePhaseDatesDTO.build(phase))
    );
  }
}


/**
 * Project attachment DTO.
 */
export class MobileAttachmentDTO {
  /**
   * @param {string} id - Attachment UUID.
   * @param {string} url - Public S3 URL.
   * @param {string} fileType - MIME / file type string.
   * @param {string | null} fileName - Original file name.
   * @param {number | null} fileSize - File size in bytes.
   * @param {boolean} isCover - Whether this photo is the project cover image.
   * @param {AttachmentCategory} category - Attachment category.
   * @param {string | null} projectId - Linked project id.
   * @param {string | null} inspectionId - Linked inspection id.
   * @param {string} createdAt - ISO created timestamp.
   */
  constructor(
    public id: string,
    public url: string,
    public fileType: string,
    public fileName: string | null,
    public fileSize: number | null,
    public isCover: boolean,
    public category: AttachmentCategory,
    public projectId: string | null,
    public inspectionId: string | null,
    public createdAt: string
  ) {}

  /**
   * Builds an attachment DTO.
   *
   * @param {Attachment} attachment - Prisma attachment row.
   * @returns {MobileAttachmentDTO} API-safe attachment object.
   */
  static build(attachment: Attachment): MobileAttachmentDTO {
    return new MobileAttachmentDTO(
      attachment.id,
      attachment.url,
      attachment.fileType,
      attachment.fileName,
      attachment.fileSize,
      attachment.isCover,
      attachment.category,
      attachment.projectId,
      attachment.inspectionId,
      attachment.createdAt.toISOString()
    );
  }
}

/**
 * Project detail hub payload for Overview and header badges.
 * Location via `coordinates`; contacts via `customer.primaryContact` (not duplicated).
 */
export class MobileProjectDetailDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {{ lat: number; lng: number } | null} coordinates - Geo coordinates object.
   * @param {string | null} siteAccessCode - Gate / access code.
   * @param {string | null} siteAccessNotes - Access notes.
   * @param {{ area: number | null; height: number | null; type: string | null }} scaffoldSpecification - Scaffold area/height/type.
   * @param {{ id: string; type: 'erection' | 'dismantling' | 'standing' | 'other'; startDate: string | null; endDate: string | null; durationDays: number | null }[]} scheduleData - Flutter Activity Type schedules.
   * @param {{ id: string; appointmentDate: string; siteTitle: string; address: string; city: string | null } | null} nextSafetyInspection - Next pending customer inspection.
   * @param {number} budgetedHours - Labor budget hours.
   * @param {number} totalLoggedHours - Approved logged hours.
   * @param {boolean} isProfitable - Whether logged hours are within budget.
   * @param {MobilePhaseDatesDTO[]} phases - Project phases with dates/safety.
   * @param {{ id: string; name: string; category: CustomerCategory; primaryContact: { name: string; phone: string | null; email: string | null } | null }} customer - Customer + primary contact.
   * @param {MobileHoursByActivityDTO[]} hoursByActivity - Hours grouped by activity.
   * @param {MobileCrewBreakdownDTO[]} crewBreakdown - Per-crew logged hours.
   * @param {{ photos: number; pdfPlans: number }} attachmentCounts - Attachment tab badges.
   */
  constructor(
    public id: string,
    public name: string,
    public coordinates: { lat: number; lng: number } | null,
    public siteAccessCode: string | null,
    public siteAccessNotes: string | null,
    public scaffoldSpecification: {
      area: number | null;
      height: number | null;
      type: string | null;
    },
    public scheduleData: Array<{
      id: string;
      type: 'erection' | 'dismantling' | 'standing' | 'other';
      startDate: string | null;
      endDate: string | null;
      durationDays: number | null;
    }>,
    public nextSafetyInspection: {
      id: string;
      appointmentDate: string;
      siteTitle: string;
      address: string;
      city: string | null;
    } | null,
    public budgetedHours: number,
    public totalLoggedHours: number,
    public isProfitable: boolean,
    public phases: MobilePhaseDatesDTO[],
    public customer: {
      id: string;
      name: string;
      category: CustomerCategory;
      primaryContact: {
        name: string;
        phone: string | null;
        email: string | null;
      } | null;
    },
    public hoursByActivity: MobileHoursByActivityDTO[],
    public crewBreakdown: MobileCrewBreakdownDTO[],
    public attachmentCounts: { photos: number; pdfPlans: number }
  ) {}
}

/**
 * Project history / audit timeline row.
 */
export class MobileProjectHistoryDTO {
  /**
   * @param {string} id - Audit log UUID.
   * @param {string} action - Action key.
   * @param {string} details - Human-readable or JSON details.
   * @param {string} createdAt - ISO timestamp.
   * @param {{ id: string; firstName: string; lastName: string; role: Role }} user - Actor.
   */
  constructor(
    public id: string,
    public action: string,
    public details: string,
    public createdAt: string,
    public user: {
      id: string;
      firstName: string;
      lastName: string;
      role: Role;
    }
  ) {}
}

export { decimalToNumber };
