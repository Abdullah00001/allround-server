import {
  ActivityType,
  PhaseType,
  TimeLog,
  TimeLogBreak,
  TimeLogStatus,
  User,
} from '@prisma/client';
import {
  calculateNetHours,
  sumBreakMinutes,
} from '@/app/modules/timelog/timelog.helpers';

/**
 * Nested user projection for time-log responses.
 */
export class TimeLogUserDTO {
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
   * Builds a user DTO from a Prisma projection.
   *
   * @param {Pick<User, 'id' | 'firstName' | 'lastName'>} user - User fields.
   * @returns {TimeLogUserDTO} API-safe user reference.
   */
  static build(user: Pick<User, 'id' | 'firstName' | 'lastName'>) {
    return new TimeLogUserDTO(user.id, user.firstName, user.lastName);
  }
}

/**
 * Nested phase/project projection for time-log responses.
 */
export class TimeLogPhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {{ id: string; name: string }} project - Parent project summary.
   */
  constructor(
    public id: string,
    public type: PhaseType,
    public project: { id: string; name: string }
  ) {}

  /**
   * Builds a phase DTO with nested project name.
   *
   * @param {{ id: string; type: PhaseType; project: { id: string; name: string } }} phase - Phase with project.
   * @returns {TimeLogPhaseDTO} API-safe phase reference.
   */
  static build(phase: {
    id: string;
    type: PhaseType;
    project: { id: string; name: string };
  }) {
    return new TimeLogPhaseDTO(phase.id, phase.type, {
      id: phase.project.id,
      name: phase.project.name,
    });
  }
}

/**
 * Standard time-log response DTO including computed `netHours`.
 */
export class TimeLogDTO {
  /**
   * @param {string} id - Time log UUID.
   * @param {string} userId - Worker UUID.
   * @param {string} phaseId - Phase UUID.
   * @param {ActivityType} activityType - Activity category.
   * @param {string} startTime - ISO start timestamp.
   * @param {string | null} endTime - ISO end timestamp or null.
   * @param {boolean} isManual - Whether the log was entered manually by admin.
   * @param {TimeLogStatus} status - Approval status.
   * @param {string | null} editReason - Last admin edit reason when provided.
   * @param {number} breakMinutes - Total break minutes.
   * @param {number} netHours - Net hours after subtracting breaks.
   * @param {TimeLogUserDTO} user - Nested user.
   * @param {TimeLogPhaseDTO} phase - Nested phase with project.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public userId: string,
    public phaseId: string,
    public activityType: ActivityType,
    public startTime: string,
    public endTime: string | null,
    public isManual: boolean,
    public status: TimeLogStatus,
    public editReason: string | null,
    public breakMinutes: number,
    public netHours: number,
    public user: TimeLogUserDTO,
    public phase: TimeLogPhaseDTO,
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a time-log DTO from Prisma data with breaks and relations.
   *
   * @param {TimeLog & { breaks: TimeLogBreak[]; user: Pick<User, 'id' | 'firstName' | 'lastName'>; phase: { id: string; type: PhaseType; project: { id: string; name: string } } }} timeLog - Time log with includes.
   * @returns {TimeLogDTO} API-safe time log object.
   */
  static build(
    timeLog: TimeLog & {
      breaks: TimeLogBreak[];
      user: Pick<User, 'id' | 'firstName' | 'lastName'>;
      phase: {
        id: string;
        type: PhaseType;
        project: { id: string; name: string };
      };
    }
  ) {
    return new TimeLogDTO(
      timeLog.id,
      timeLog.userId,
      timeLog.phaseId,
      timeLog.activityType,
      timeLog.startTime.toISOString(),
      timeLog.endTime ? timeLog.endTime.toISOString() : null,
      timeLog.isManual,
      timeLog.status,
      timeLog.editReason,
      Number(sumBreakMinutes(timeLog.breaks).toFixed(2)),
      calculateNetHours(timeLog),
      TimeLogUserDTO.build(timeLog.user),
      TimeLogPhaseDTO.build(timeLog.phase),
      timeLog.createdAt.toISOString(),
      timeLog.updatedAt.toISOString()
    );
  }
}
