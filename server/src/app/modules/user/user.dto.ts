import {
  ActivityType,
  Role,
  TimeLog,
  TimeLogStatus,
  User,
  UserStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Converts a Prisma Decimal into a plain number.
 *
 * @param {Decimal} value - Prisma decimal value.
 * @returns {number} Numeric representation.
 */
const decimalToNumber = (value: Decimal): number => Number(value);

/**
 * Compact project reference for user detail assignments.
 */
export class ManagedUserProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} assignedAt - ISO assignment timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public assignedAt: string
  ) {}
}

/**
 * Compact time-log reference for user detail.
 */
export class ManagedUserTimeLogDTO {
  /**
   * @param {string} id - Time log UUID.
   * @param {ActivityType} activityType - Activity category.
   * @param {string} startTime - ISO start timestamp.
   * @param {string | null} endTime - ISO end timestamp.
   * @param {TimeLogStatus} status - Approval status.
   */
  constructor(
    public id: string,
    public activityType: ActivityType,
    public startTime: string,
    public endTime: string | null,
    public status: TimeLogStatus
  ) {}

  /**
   * Builds a compact time-log DTO.
   *
   * @param {Pick<TimeLog, 'id' | 'activityType' | 'startTime' | 'endTime' | 'status'>} timeLog - Time log fields.
   * @returns {ManagedUserTimeLogDTO} API-safe time log summary.
   */
  static build(
    timeLog: Pick<
      TimeLog,
      'id' | 'activityType' | 'startTime' | 'endTime' | 'status'
    >
  ) {
    return new ManagedUserTimeLogDTO(
      timeLog.id,
      timeLog.activityType,
      timeLog.startTime.toISOString(),
      timeLog.endTime ? timeLog.endTime.toISOString() : null,
      timeLog.status
    );
  }
}

/**
 * User list-item DTO with assignment counts (never includes passwordHash).
 */
export class ManagedUserListItemDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string} email - Email address.
   * @param {Role} role - System role.
   * @param {UserStatus} status - Account status.
   * @param {string | null} phone - Optional phone.
   * @param {string | null} avatarUrl - Optional avatar URL.
   * @param {number} weeklyHoursTarget - Weekly hours target.
   * @param {number} projectManagementsCount - Count of project manager assignments.
   * @param {number} crewAssignmentsCount - Count of crew assignments.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public role: Role,
    public status: UserStatus,
    public phone: string | null,
    public avatarUrl: string | null,
    public weeklyHoursTarget: number,
    public projectManagementsCount: number,
    public crewAssignmentsCount: number,
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a list-item DTO from Prisma user + counts.
   *
   * @param {User & { _count: { projectManagements: number; crewAssignments: number } }} user - User with counts.
   * @returns {ManagedUserListItemDTO} API-safe list row.
   */
  static build(
    user: User & {
      _count: { projectManagements: number; crewAssignments: number };
    }
  ) {
    return new ManagedUserListItemDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.role,
      user.status,
      user.phone,
      user.avatarUrl,
      decimalToNumber(user.weeklyHoursTarget),
      user._count.projectManagements,
      user._count.crewAssignments,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }
}

/**
 * User summary DTO returned after create/update (never includes passwordHash).
 */
export class ManagedUserSummaryDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string} email - Email address.
   * @param {Role} role - System role.
   * @param {UserStatus} status - Account status.
   * @param {string | null} phone - Optional phone.
   * @param {string | null} avatarUrl - Optional avatar URL.
   * @param {number} weeklyHoursTarget - Weekly hours target.
   * @param {boolean} isProfileSetup - Profile setup flag.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public role: Role,
    public status: UserStatus,
    public phone: string | null,
    public avatarUrl: string | null,
    public weeklyHoursTarget: number,
    public isProfileSetup: boolean,
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a summary DTO from a Prisma user.
   *
   * @param {User} user - User entity.
   * @returns {ManagedUserSummaryDTO} API-safe summary.
   */
  static build(user: User) {
    return new ManagedUserSummaryDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.role,
      user.status,
      user.phone,
      user.avatarUrl,
      decimalToNumber(user.weeklyHoursTarget),
      user.isProfileSetup,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }
}

/**
 * User detail DTO including assigned projects and recent time logs.
 */
export class ManagedUserDetailDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string} email - Email address.
   * @param {Role} role - System role.
   * @param {UserStatus} status - Account status.
   * @param {string | null} phone - Optional phone.
   * @param {string | null} avatarUrl - Optional avatar URL.
   * @param {number} weeklyHoursTarget - Weekly hours target.
   * @param {boolean} isProfileSetup - Profile setup flag.
   * @param {string | null} lastLoginAt - ISO last login timestamp.
   * @param {ManagedUserProjectDTO[]} assignedProjects - Project manager assignments.
   * @param {ManagedUserTimeLogDTO[]} recentTimeLogs - Latest time logs (max 5).
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public role: Role,
    public status: UserStatus,
    public phone: string | null,
    public avatarUrl: string | null,
    public weeklyHoursTarget: number,
    public isProfileSetup: boolean,
    public lastLoginAt: string | null,
    public assignedProjects: ManagedUserProjectDTO[],
    public recentTimeLogs: ManagedUserTimeLogDTO[],
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a detail DTO from Prisma user with relations.
   *
   * @param {User & { projectManagements: Array<{ assignedAt: Date; project: { id: string; name: string } }>; timeLogs: Array<Pick<TimeLog, 'id' | 'activityType' | 'startTime' | 'endTime' | 'status'>> }} user - User with includes.
   * @returns {ManagedUserDetailDTO} API-safe detail payload.
   */
  static build(
    user: User & {
      projectManagements: Array<{
        assignedAt: Date;
        project: { id: string; name: string };
      }>;
      timeLogs: Array<
        Pick<
          TimeLog,
          'id' | 'activityType' | 'startTime' | 'endTime' | 'status'
        >
      >;
    }
  ) {
    return new ManagedUserDetailDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.role,
      user.status,
      user.phone,
      user.avatarUrl,
      decimalToNumber(user.weeklyHoursTarget),
      user.isProfileSetup,
      user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      user.projectManagements.map(
        (assignment) =>
          new ManagedUserProjectDTO(
            assignment.project.id,
            assignment.project.name,
            assignment.assignedAt.toISOString()
          )
      ),
      user.timeLogs.map(ManagedUserTimeLogDTO.build),
      user.createdAt.toISOString(),
      user.updatedAt.toISOString()
    );
  }
}
