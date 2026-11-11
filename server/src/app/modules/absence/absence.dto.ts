import { Absence, AbsenceType, User } from '@prisma/client';

/**
 * Nested user projection for absence responses.
 */
export class AbsenceUserDTO {
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
   * @returns {AbsenceUserDTO} API-safe user reference.
   */
  static build(user: Pick<User, 'id' | 'firstName' | 'lastName'>) {
    return new AbsenceUserDTO(user.id, user.firstName, user.lastName);
  }
}

/**
 * Standard absence response DTO.
 */
export class AbsenceDTO {
  /**
   * @param {string} id - Absence UUID.
   * @param {string} userId - Employee UUID.
   * @param {AbsenceType} type - Absence type.
   * @param {string} startDate - ISO start timestamp.
   * @param {string} endDate - ISO end timestamp.
   * @param {string | null} note - Optional note.
   * @param {AbsenceUserDTO} user - Nested user.
   * @param {string} createdAt - ISO creation timestamp.
   */
  constructor(
    public id: string,
    public userId: string,
    public type: AbsenceType,
    public startDate: string,
    public endDate: string,
    public note: string | null,
    public user: AbsenceUserDTO,
    public createdAt: string
  ) {}

  /**
   * Builds an absence DTO from Prisma data with nested user.
   *
   * @param {Absence & { user: Pick<User, 'id' | 'firstName' | 'lastName'> }} absence - Absence with user.
   * @returns {AbsenceDTO} API-safe absence object.
   */
  static build(
    absence: Absence & {
      user: Pick<User, 'id' | 'firstName' | 'lastName'>;
    }
  ) {
    return new AbsenceDTO(
      absence.id,
      absence.userId,
      absence.type,
      absence.startDate.toISOString(),
      absence.endDate.toISOString(),
      absence.note,
      AbsenceUserDTO.build(absence.user),
      absence.createdAt.toISOString()
    );
  }
}
