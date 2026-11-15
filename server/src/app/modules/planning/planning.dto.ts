import {
  AbsenceType,
  CrewAssignment,
  Customer,
  CustomerCategory,
  PhaseStatus,
  PhaseType,
  Priority,
  Project,
  ProjectPhase,
  Role,
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
 * Customer reference nested under a daily plan project.
 */
export class DailyPlanCustomerDTO {
  /**
   * @param {string} id - Customer UUID.
   * @param {string} name - Customer name.
   * @param {CustomerCategory} category - Customer category.
   */
  constructor(
    public id: string,
    public name: string,
    public category: CustomerCategory
  ) {}

  static build(customer: Pick<Customer, 'id' | 'name' | 'category'>) {
    return new DailyPlanCustomerDTO(
      customer.id,
      customer.name,
      customer.category
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
   * @param {DailyPlanCustomerDTO | null} customer - Linked customer.
   * @param {PlanningUserDTO | null} siteManager - Assigned site manager.
   * @param {string} workingHours - Operating working hours.
   */
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public customer: DailyPlanCustomerDTO | null = null,
    public siteManager: PlanningUserDTO | null = null,
    public workingHours: string = '07:30 am - 04:30 pm'
  ) {}

  /**
   * Builds a project summary DTO.
   *
   * @param {Pick<Project, 'id' | 'name' | 'address'> & { customer?: Pick<Customer, 'id' | 'name' | 'category'> | null; projectManagers?: Array<{ manager: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }> }} project - Project fields with relations.
   * @returns {DailyPlanProjectDTO} API-safe project summary.
   */
  static build(
    project: Pick<Project, 'id' | 'name' | 'address'> & {
      customer?: Pick<Customer, 'id' | 'name' | 'category'> | null;
      projectManagers?: Array<{
        user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
      }>;
    }
  ) {
    const siteManager = project.projectManagers?.[0]?.user
      ? PlanningUserDTO.build(project.projectManagers[0].user)
      : null;
    const customer = project.customer
      ? DailyPlanCustomerDTO.build(project.customer)
      : null;

    return new DailyPlanProjectDTO(
      project.id,
      project.name,
      project.address,
      customer,
      siteManager,
      '07:30 am - 04:30 pm'
    );
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
   * @param {ProjectPhase & { project: Pick<Project, 'id' | 'name' | 'address'> & { customer?: Pick<Customer, 'id' | 'name' | 'category'> | null; projectManagers?: Array<{ manager: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }> }; crewAssignments: Array<CrewAssignment & { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }>; vehicleAssignments: Array<VehicleAssignment & { vehicle: Pick<Vehicle, 'id' | 'name' | 'plateNumber' | 'imageUrl'>; user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'> }> }} phase - Phase with nested data.
   * @returns {DailyPlanPhaseDTO} API-safe daily plan phase card.
   */
  static build(
    phase: ProjectPhase & {
      project: Pick<Project, 'id' | 'name' | 'address'> & {
        customer?: Pick<Customer, 'id' | 'name' | 'category'> | null;
        projectManagers?: Array<{
          user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
        }>;
      };
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
 * Detailed employee resource status for the assign modal.
 */
export class AvailableEmployeeResourceDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string | null} avatarUrl - Avatar URL or null.
   * @param {Role} role - User role (EMPLOYEE or SITE_MANAGER).
   * @param {'AVAILABLE' | 'ASSIGNED' | 'PARTIALLY_ASSIGNED' | 'VACATION' | 'SICK_LEAVE'} status - Daily status key.
   * @param {string} statusLabel - Human-readable label (e.g. 'Available', 'Assigned', 'Vacation', 'Available - also on other tasks (4h)').
   * @param {boolean} isAssignedToPhase - True when worker already assigned to target phase.
   * @param {number | null} assignedHoursOnPhase - Planned hours on target phase if already added.
   * @param {number} totalAssignedHours - Total hours planned across all tasks on date.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null,
    public role: Role,
    public status:
      | 'AVAILABLE'
      | 'ASSIGNED'
      | 'PARTIALLY_ASSIGNED'
      | 'VACATION'
      | 'SICK_LEAVE',
    public statusLabel: string,
    public isAssignedToPhase: boolean,
    public assignedHoursOnPhase: number | null,
    public totalAssignedHours: number
  ) {}
}

/**
 * Detailed vehicle resource status for the assign modal.
 */
export class AvailableVehicleResourceDTO {
  /**
   * @param {string} id - Vehicle UUID.
   * @param {string} name - Vehicle name.
   * @param {string} plateNumber - License plate.
   * @param {string | null} imageUrl - Vehicle image URL.
   * @param {'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE'} status - Status key.
   * @param {boolean} isAssignedToPhase - True when vehicle assigned to target phase.
   * @param {string | null} assignedProjectName - Other project name if assigned elsewhere.
   */
  constructor(
    public id: string,
    public name: string,
    public plateNumber: string,
    public imageUrl: string | null,
    public status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE',
    public isAssignedToPhase: boolean,
    public assignedProjectName: string | null
  ) {}
}

/**
 * Available resources payload for the assign modal.
 */
export class AvailableResourcesDTO {
  /**
   * @param {AvailableEmployeeResourceDTO[]} employees - Workforce list with status.
   * @param {AvailableVehicleResourceDTO[]} vehicles - Fleet list with status.
   */
  constructor(
    public employees: AvailableEmployeeResourceDTO[],
    public vehicles: AvailableVehicleResourceDTO[]
  ) {}
}

/**
 * Summary metrics cards across the top of the daily planning board.
 */
export class DailyPlanSummaryDTO {
  /**
   * @param {number} totalWorkers - Total active workers.
   * @param {number} availableWorkers - Active workers with capacity.
   * @param {number} assignedWorkers - Workers assigned to at least one phase today.
   * @param {number} absentWorkers - Workers on vacation or sick leave today.
   */
  constructor(
    public totalWorkers: number,
    public availableWorkers: number,
    public assignedWorkers: number,
    public absentWorkers: number
  ) {}
}

/**
 * Employee entry in the daily planning right sidebar.
 */
export class DailyPlanSidebarEmployeeDTO {
  /**
   * @param {string} id - User UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string | null} avatarUrl - Avatar URL.
   * @param {Role} role - Worker role.
   * @param {'ASSIGNED' | 'UNASSIGNED' | 'VACATION' | 'SICK_LEAVE'} status - Daily status.
   * @param {number} totalHours - Total hours assigned on date.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null,
    public role: Role,
    public status: 'ASSIGNED' | 'UNASSIGNED' | 'VACATION' | 'SICK_LEAVE',
    public totalHours: number
  ) {}
}

/**
 * Vehicle entry in the daily planning right sidebar.
 */
export class DailyPlanSidebarVehicleDTO {
  /**
   * @param {string} id - Vehicle UUID.
   * @param {string} name - Vehicle name.
   * @param {string} plateNumber - License plate.
   * @param {string | null} imageUrl - Vehicle image.
   * @param {'FREE' | 'ASSIGNED'} status - Daily availability.
   * @param {string | null} assignedProjectName - Project name if assigned today.
   */
  constructor(
    public id: string,
    public name: string,
    public plateNumber: string,
    public imageUrl: string | null,
    public status: 'FREE' | 'ASSIGNED',
    public assignedProjectName: string | null
  ) {}
}

/**
 * Sidebar data for the daily planning board.
 */
export class DailyPlanSidebarDTO {
  /**
   * @param {DailyPlanSidebarEmployeeDTO[]} employees - Workforce list.
   * @param {DailyPlanSidebarVehicleDTO[]} vehicles - Fleet list.
   */
  constructor(
    public employees: DailyPlanSidebarEmployeeDTO[],
    public vehicles: DailyPlanSidebarVehicleDTO[]
  ) {}
}

/**
 * Complete daily plan response board.
 */
export class DailyPlanBoardDTO {
  /**
   * @param {DailyPlanSummaryDTO} summary - Top KPI metric cards.
   * @param {DailyPlanPhaseDTO[]} phases - Main phase cards.
   * @param {DailyPlanSidebarDTO} sidebar - Right sidebar lists.
   */
  constructor(
    public summary: DailyPlanSummaryDTO,
    public phases: DailyPlanPhaseDTO[],
    public sidebar: DailyPlanSidebarDTO
  ) {}
}

/**
 * Day cell representation for weekly staff planning grid.
 */
export class WeeklyPlanDayCellDTO {
  /**
   * @param {string} date - Date string YYYY-MM-DD.
   * @param {string} dayName - Day of week (e.g. 'Monday').
   * @param {number} assignedHours - Planned hours for the day.
   * @param {number} maxHours - Standard work day capacity (8).
   * @param {string} utilization - Utilization level key.
   * @param {string} color - Guidelines progress bar color.
   * @param {AbsenceType | null} absenceType - Absence type if absent.
   */
  constructor(
    public date: string,
    public dayName: string,
    public assignedHours: number,
    public maxHours: number,
    public utilization:
      | 'AVAILABLE'
      | 'PARTIALLY_ASSIGNED'
      | 'HIGHLY_UTILIZED'
      | 'FULLY_ASSIGNED'
      | 'VACATION'
      | 'SICK_LEAVE'
      | 'OTHER_ABSENCE',
    public color:
      | 'GREEN'
      | 'YELLOW'
      | 'ORANGE'
      | 'RED'
      | 'PURPLE'
      | 'BLUE'
      | 'GRAY',
    public absenceType: AbsenceType | null
  ) {}
}

/**
 * Worker row in weekly staff planning grid.
 */
export class WeeklyPlanEmployeeDTO {
  /**
   * @param {string} id - Worker UUID.
   * @param {string} firstName - First name.
   * @param {string} lastName - Last name.
   * @param {string | null} avatarUrl - Avatar URL.
   * @param {Role} role - Worker role.
   * @param {WeeklyPlanDayCellDTO[]} days - Matrix of daily cells.
   */
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public avatarUrl: string | null,
    public role: Role,
    public days: WeeklyPlanDayCellDTO[]
  ) {}
}

/**
 * Complete weekly staff planning overview payload.
 */
export class WeeklyPlanDTO {
  /**
   * @param {string} startDate - Range start date YYYY-MM-DD.
   * @param {string} endDate - Range end date YYYY-MM-DD.
   * @param {string[]} days - List of calendar dates in the grid.
   * @param {WeeklyPlanEmployeeDTO[]} employees - Worker rows with daily cells.
   */
  constructor(
    public startDate: string,
    public endDate: string,
    public days: string[],
    public employees: WeeklyPlanEmployeeDTO[]
  ) {}
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
