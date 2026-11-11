import {
  CrewAssignment,
  PhaseStatus,
  PhaseType,
  Priority,
  Project,
  ProjectPhase,
  User,
  Vehicle,
  VehicleAssignment,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { formatUtcDay } from '@/app/modules/planning/planning.helpers';

/**
 * Converts a Prisma Decimal into a plain number.
 *
 * @param {Decimal} value - Prisma decimal value.
 * @returns {number} Numeric representation.
 */
const decimalToNumber = (value: Decimal): number => Number(value);

/**
 * Compact user DTO for planning UI (name + avatar).
 */
export class PlanningUserDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string | null} avatarUrl - Optional avatar URL.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null
  ) {}

  /**
   * Builds a planning user DTO from a Prisma user projection.
   *
   * @param {Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>} user - User fields.
   * @returns {PlanningUserDTO} API-safe user reference.
   */
  static build(
    user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  ) {
    return new PlanningUserDTO(
      user.id,
      user.firstName,
      user.lastName,
      user.avatarUrl
    );
  }
}

/**
 * Compact vehicle DTO for planning UI.
 */
export class PlanningVehicleDTO {
  /**
   * @param {string} id - Vehicle UUID.
   * @param {string} name - Vehicle display name.
   * @param {string} plateNumber - License plate.
   * @param {string | null} imageUrl - Optional vehicle image.
   */
  constructor(
    public id: string,
    public name: string,
    public plateNumber: string,
    public imageUrl: string | null
  ) {}

  /**
   * Builds a planning vehicle DTO.
   *
   * @param {Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>} vehicle - Vehicle fields.
   * @returns {PlanningVehicleDTO} API-safe vehicle reference.
   */
  static build(
    vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>
  ) {
    return new PlanningVehicleDTO(
      vehicle.id,
      vehicle.name,
      vehicle.plateNumber,
      vehicle.imageUrl
    );
  }
}

/**
 * Crew assignment row within a daily plan phase.
 */
export class DailyPlanCrewAssignmentDTO {
  /**
   * @param {string} id - Assignment UUID.
   * @param {string} date - Calendar date `YYYY-MM-DD`.
   * @param {number} hours - Planned hours.
   * @param {PlanningUserDTO} user - Assigned worker.
   */
  constructor(
    public id: string,
    public date: string,
    public hours: number,
    public user: PlanningUserDTO
  ) {}

  /**
   * Builds a crew assignment DTO.
   *
   * @param {CrewAssignment & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }} assignment - Assignment with user.
   * @returns {DailyPlanCrewAssignmentDTO} API-safe crew assignment.
   */
  static build(
    assignment: CrewAssignment & {
      user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
    }
  ) {
    return new DailyPlanCrewAssignmentDTO(
      assignment.id,
      formatUtcDay(assignment.date),
      decimalToNumber(assignment.hours),
      PlanningUserDTO.build(assignment.user)
    );
  }
}

/**
 * Vehicle assignment row within a daily plan phase.
 */
export class DailyPlanVehicleAssignmentDTO {
  /**
   * @param {string} id - Assignment UUID.
   * @param {string} date - Calendar date `YYYY-MM-DD`.
   * @param {PlanningVehicleDTO} vehicle - Assigned vehicle.
   * @param {PlanningUserDTO} user - Driver / responsible user.
   */
  constructor(
    public id: string,
    public date: string,
    public vehicle: PlanningVehicleDTO,
    public user: PlanningUserDTO
  ) {}

  /**
   * Builds a vehicle assignment DTO.
   *
   * @param {VehicleAssignment & { vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>; user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }} assignment - Assignment with relations.
   * @returns {DailyPlanVehicleAssignmentDTO} API-safe vehicle assignment.
   */
  static build(
    assignment: VehicleAssignment & {
      vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>;
      user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
    }
  ) {
    return new DailyPlanVehicleAssignmentDTO(
      assignment.id,
      formatUtcDay(assignment.date),
      PlanningVehicleDTO.build(assignment.vehicle),
      PlanningUserDTO.build(assignment.user)
    );
  }
}

/**
 * Project summary nested under a daily plan phase.
 */
export class DailyPlanProjectDTO {
  /**
   * @param {string} id - Project UUID.
   * @param {string} name - Project name.
   * @param {string} address - Project address.
   */
  constructor(
    public id: string,
    public name: string,
    public address: string
  ) {}

  /**
   * Builds a project summary DTO.
   *
   * @param {Pick<Project, 'id' | 'name' | 'address'>} project - Project fields.
   * @returns {DailyPlanProjectDTO} API-safe project summary.
   */
  static build(project: Pick<Project, 'id' | 'name' | 'address'>) {
    return new DailyPlanProjectDTO(project.id, project.name, project.address);
  }
}

/**
 * Phase card for the daily planning board.
 */
export class DailyPlanPhaseDTO {
  /**
   * @param {string} id - Phase UUID.
   * @param {PhaseType} type - Phase type.
   * @param {PhaseStatus} status - Phase status.
   * @param {Priority} priority - Phase priority.
   * @param {string | null} startDate - ISO start date or null.
   * @param {string | null} endDate - ISO end date or null.
   * @param {DailyPlanProjectDTO} project - Parent project.
   * @param {DailyPlanCrewAssignmentDTO[]} crewAssignments - Crew for the day.
   * @param {DailyPlanVehicleAssignmentDTO[]} vehicleAssignments - Vehicles for the day.
   */
  constructor(
    public id: string,
    public type: PhaseType,
    public status: PhaseStatus,
    public priority: Priority,
    public startDate: string | null,
    public endDate: string | null,
    public project: DailyPlanProjectDTO,
    public crewAssignments: DailyPlanCrewAssignmentDTO[],
    public vehicleAssignments: DailyPlanVehicleAssignmentDTO[]
  ) {}

  /**
   * Builds a daily plan phase DTO from Prisma phase + day-scoped assignments.
   *
   * @param {ProjectPhase & { project: Pick<Project, 'id' | 'name' | 'address'>; crewAssignments: Array<CrewAssignment & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }>; vehicleAssignments: Array<VehicleAssignment & { vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>; user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }> }} phase - Phase with nested data.
   * @returns {DailyPlanPhaseDTO} API-safe daily plan phase card.
   */
  static build(
    phase: ProjectPhase & {
      project: Pick<Project, 'id' | 'name' | 'address'>;
      crewAssignments: Array<
        CrewAssignment & {
          user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
        }
      >;
      vehicleAssignments: Array<
        VehicleAssignment & {
          vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>;
          user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
        }
      >;
    }
  ) {
    return new DailyPlanPhaseDTO(
      phase.id,
      phase.type,
      phase.status,
      phase.priority,
      phase.startDate ? phase.startDate.toISOString() : null,
      phase.endDate ? phase.endDate.toISOString() : null,
      DailyPlanProjectDTO.build(phase.project),
      phase.crewAssignments.map(DailyPlanCrewAssignmentDTO.build),
      phase.vehicleAssignments.map(DailyPlanVehicleAssignmentDTO.build)
    );
  }
}

/**
 * Available resources payload for the assign modal.
 */
export class AvailableResourcesDTO {
  /**
   * @param {PlanningUserDTO[]} employees - Available employees/site managers.
   * @param {PlanningVehicleDTO[]} vehicles - Available vehicles for the date.
   */
  constructor(
    public employees: PlanningUserDTO[],
    public vehicles: PlanningVehicleDTO[]
  ) {}

  /**
   * Builds the available-resources DTO.
   *
   * @param {Array<Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>>} employees - Eligible users.
   * @param {Array<Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>>} vehicles - Eligible vehicles.
   * @returns {AvailableResourcesDTO} API-safe resources payload.
   */
  static build(
    employees: Array<Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>>,
    vehicles: Array<Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>>
  ) {
    return new AvailableResourcesDTO(
      employees.map(PlanningUserDTO.build),
      vehicles.map(PlanningVehicleDTO.build)
    );
  }
}

/**
 * Response DTO after upserting a crew assignment.
 */
export class AssignCrewDTO {
  /**
   * @param {string} id - Assignment UUID.
   * @param {string} phaseId - Phase UUID.
   * @param {string} userId - User UUID.
   * @param {string} date - Calendar date.
   * @param {number} hours - Planned hours.
   * @param {PlanningUserDTO} user - Assigned user details.
   */
  constructor(
    public id: string,
    public phaseId: string,
    public userId: string,
    public date: string,
    public hours: number,
    public user: PlanningUserDTO
  ) {}

  /**
   * Builds an assign-crew response DTO.
   *
   * @param {CrewAssignment & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }} assignment - Upserted assignment.
   * @returns {AssignCrewDTO} API-safe assignment payload.
   */
  static build(
    assignment: CrewAssignment & {
      user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
    }
  ) {
    return new AssignCrewDTO(
      assignment.id,
      assignment.phaseId,
      assignment.userId,
      formatUtcDay(assignment.date),
      decimalToNumber(assignment.hours),
      PlanningUserDTO.build(assignment.user)
    );
  }
}

/**
 * Response DTO after creating a vehicle assignment.
 */
export class AssignVehicleDTO {
  /**
   * @param {string} id - Assignment UUID.
   * @param {string} phaseId - Phase UUID.
   * @param {string} userId - User UUID.
   * @param {string} vehicleId - Vehicle UUID.
   * @param {string} date - Calendar date.
   * @param {PlanningUserDTO} user - Responsible user.
   * @param {PlanningVehicleDTO} vehicle - Assigned vehicle.
   */
  constructor(
    public id: string,
    public phaseId: string,
    public userId: string,
    public vehicleId: string,
    public date: string,
    public user: PlanningUserDTO,
    public vehicle: PlanningVehicleDTO
  ) {}

  /**
   * Builds an assign-vehicle response DTO.
   *
   * @param {VehicleAssignment & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>; vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'> }} assignment - Created assignment.
   * @returns {AssignVehicleDTO} API-safe assignment payload.
   */
  static build(
    assignment: VehicleAssignment & {
      user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
      vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>;
    }
  ) {
    return new AssignVehicleDTO(
      assignment.id,
      assignment.phaseId,
      assignment.userId,
      assignment.vehicleId,
      formatUtcDay(assignment.date),
      PlanningUserDTO.build(assignment.user),
      PlanningVehicleDTO.build(assignment.vehicle)
    );
  }
}
