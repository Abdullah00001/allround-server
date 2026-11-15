import {
  AbsenceType,
  NotificationType,
  PhaseStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  AssignCrewDTO,
  AssignVehicleDTO,
  AvailableEmployeeResourceDTO,
  AvailableResourcesDTO,
  AvailableVehicleResourceDTO,
  DailyPlanBoardDTO,
  DailyPlanPhaseDTO,
  DailyPlanSidebarDTO,
  DailyPlanSidebarEmployeeDTO,
  DailyPlanSidebarVehicleDTO,
  DailyPlanSummaryDTO,
  WeeklyPlanDayCellDTO,
  WeeklyPlanDTO,
  WeeklyPlanEmployeeDTO,
} from '@/app/modules/planning/planning.dto';
import {
  formatUtcDay,
  getDatesInRange,
  getDayName,
  toUtcDayDate,
  toUtcDayEnd,
} from '@/app/modules/planning/planning.helpers';
import {
  TAssignCrewServiceParams,
  TAssignVehicleServiceParams,
  TGetAvailableResourcesServiceParams,
  TGetDailyPlanServiceParams,
  TGetWeeklyPlanServiceParams,
  TUnassignCrewServiceParams,
  TUnassignVehicleServiceParams,
} from '@/app/modules/planning/planning.types';
import { triggerPushNotification } from '@/app/utils/notification.utils';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

const vehicleSelect = {
  id: true,
  name: true,
  plateNumber: true,
  imageUrl: true,
} as const;

/**
 * Loads the daily planning board for a calendar date.
 * Returns top KPI metric cards, IN_PROGRESS / ORDER_CONFIRMED phase cards
 * with customer and site manager info, and sidebar workforce and fleet status.
 *
 * @param {TGetDailyPlanServiceParams} params - Validated query wrapper.
 * @returns {Promise<DailyPlanBoardDTO>} Complete daily planning board.
 */
export const getDailyPlanService = async ({
  query,
}: TGetDailyPlanServiceParams): Promise<DailyPlanBoardDTO> => {
  const dayStart = toUtcDayDate(query.date);
  const dayEnd = toUtcDayEnd(query.date);

  const [phases, allWorkers, allVehicles] = await Promise.all([
    prisma.projectPhase.findMany({
      where: {
        status: {
          in: [PhaseStatus.IN_PROGRESS, PhaseStatus.ORDER_CONFIRMED],
        },
        project: { deletedAt: null },
        OR: [
          {
            AND: [
              { startDate: { not: null, lte: dayEnd } },
              { endDate: { not: null, gte: dayStart } },
            ],
          },
          {
            crewAssignments: {
              some: { date: dayStart },
            },
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            customer: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            projectManagers: {
              take: 1,
              include: {
                user: { select: userSelect },
              },
            },
          },
        },
        crewAssignments: {
          where: { date: dayStart },
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
        vehicleAssignments: {
          where: { date: dayStart },
          include: {
            vehicle: { select: vehicleSelect },
            user: { select: userSelect },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [Role.EMPLOYEE, Role.SITE_MANAGER] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        absences: {
          where: {
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: { type: true },
        },
        crewAssignments: {
          where: { date: dayStart },
          select: { hours: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.vehicle.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        imageUrl: true,
        assignments: {
          where: { date: dayStart },
          select: {
            phase: {
              select: {
                project: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  let totalWorkers = allWorkers.length;
  let availableWorkers = 0;
  let assignedWorkers = 0;
  let absentWorkers = 0;

  const sidebarEmployees: DailyPlanSidebarEmployeeDTO[] = allWorkers.map(
    (worker) => {
      const isAbsent = worker.absences.length > 0;
      const totalHours = worker.crewAssignments.reduce(
        (sum, a) => sum + Number(a.hours),
        0
      );

      let status: 'ASSIGNED' | 'UNASSIGNED' | 'VACATION' | 'SICK_LEAVE';
      if (isAbsent) {
        absentWorkers++;
        status =
          worker.absences[0].type === AbsenceType.VACATION
            ? 'VACATION'
            : 'SICK_LEAVE';
      } else {
        if (totalHours > 0) {
          assignedWorkers++;
          status = 'ASSIGNED';
        } else {
          status = 'UNASSIGNED';
        }
        if (totalHours < 8) {
          availableWorkers++;
        }
      }

      return new DailyPlanSidebarEmployeeDTO(
        worker.id,
        worker.firstName,
        worker.lastName,
        worker.avatarUrl,
        worker.role,
        status,
        totalHours
      );
    }
  );

  const sidebarVehicles: DailyPlanSidebarVehicleDTO[] = allVehicles.map(
    (vehicle) => {
      const assignment = vehicle.assignments[0];
      const isAssigned = Boolean(assignment);
      return new DailyPlanSidebarVehicleDTO(
        vehicle.id,
        vehicle.name,
        vehicle.plateNumber,
        vehicle.imageUrl,
        isAssigned ? 'ASSIGNED' : 'FREE',
        assignment?.phase?.project?.name ?? null
      );
    }
  );

  const summary = new DailyPlanSummaryDTO(
    totalWorkers,
    availableWorkers,
    assignedWorkers,
    absentWorkers
  );

  return new DailyPlanBoardDTO(
    summary,
    phases.map((phase) => DailyPlanPhaseDTO.build(phase)),
    new DailyPlanSidebarDTO(sidebarEmployees, sidebarVehicles)
  );
};

/**
 * Upserts a crew assignment for a phase/user/date unique triple.
 * Updates `hours` when the assignment already exists.
 *
 * @param {TAssignCrewServiceParams} params - Trusted phase and payload.
 * @returns {Promise<AssignCrewDTO>} Upserted crew assignment DTO.
 */
export const assignCrewService = async ({
  payload,
  phase,
}: TAssignCrewServiceParams): Promise<AssignCrewDTO> => {
  const dayDate = toUtcDayDate(payload.date);

  const assignment = await prisma.crewAssignment.upsert({
    where: {
      phaseId_userId_date: {
        phaseId: phase.id,
        userId: payload.userId,
        date: dayDate,
      },
    },
    create: {
      phaseId: phase.id,
      userId: payload.userId,
      date: dayDate,
      hours: new Prisma.Decimal(payload.hours),
    },
    update: {
      hours: new Prisma.Decimal(payload.hours),
    },
    include: {
      user: { select: userSelect },
      phase: {
        select: {
          type: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  await triggerPushNotification(
    [payload.userId],
    NotificationType.PROJECT_ASSIGNED,
    'notification.project_assigned.title',
    'notification.project_assigned.body',
    {
      projectName: assignment.phase.project.name,
      phaseType: assignment.phase.type,
      date: dayDate.toISOString().slice(0, 10),
    }
  );

  return AssignCrewDTO.build(assignment);
};

/**
 * Creates a vehicle assignment for a phase/user/vehicle on a calendar date.
 * Assumes middleware already blocked same-day vehicle conflicts.
 *
 * @param {TAssignVehicleServiceParams} params - Trusted phase, vehicle, user, payload.
 * @returns {Promise<AssignVehicleDTO>} Created vehicle assignment DTO.
 */
export const assignVehicleService = async ({
  payload,
  phase,
  vehicle,
  user,
}: TAssignVehicleServiceParams): Promise<AssignVehicleDTO> => {
  const dayDate = toUtcDayDate(payload.date);

  const assignment = await prisma.vehicleAssignment.create({
    data: {
      phaseId: phase.id,
      vehicleId: vehicle.id,
      userId: user.id,
      date: dayDate,
    },
    include: {
      user: { select: userSelect },
      vehicle: { select: vehicleSelect },
    },
  });

  return AssignVehicleDTO.build(assignment);
};

/**
 * Lists employees/site managers and vehicles for the resource assignment modal.
 * Returns comprehensive status for each worker and vehicle on the date,
 * including absence reasons, other project assignments, and phase membership.
 *
 * @param {TGetAvailableResourcesServiceParams} params - Validated query wrapper.
 * @returns {Promise<AvailableResourcesDTO>} Available workforce and vehicles with status.
 */
export const getAvailableResourcesService = async ({
  query,
}: TGetAvailableResourcesServiceParams): Promise<AvailableResourcesDTO> => {
  const dayStart = toUtcDayDate(query.date);
  const dayEnd = toUtcDayEnd(query.date);

  const [employees, vehicles] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [Role.EMPLOYEE, Role.SITE_MANAGER] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        absences: {
          where: {
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: { type: true },
        },
        crewAssignments: {
          where: { date: dayStart },
          select: { phaseId: true, hours: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.vehicle.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        imageUrl: true,
        assignments: {
          where: { date: dayStart },
          select: {
            phaseId: true,
            phase: {
              select: {
                project: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const employeeDtos: AvailableEmployeeResourceDTO[] = employees.map(
    (worker) => {
      const isAbsent = worker.absences.length > 0;
      const totalAssignedHours = worker.crewAssignments.reduce(
        (sum, a) => sum + Number(a.hours),
        0
      );
      const phaseAssignment = query.phaseId
        ? worker.crewAssignments.find((a) => a.phaseId === query.phaseId)
        : undefined;
      const isAssignedToPhase = Boolean(phaseAssignment);
      const assignedHoursOnPhase = phaseAssignment
        ? Number(phaseAssignment.hours)
        : null;

      let status:
        | 'AVAILABLE'
        | 'ASSIGNED'
        | 'PARTIALLY_ASSIGNED'
        | 'VACATION'
        | 'SICK_LEAVE';
      let statusLabel: string;

      if (isAbsent) {
        status =
          worker.absences[0].type === AbsenceType.VACATION
            ? 'VACATION'
            : 'SICK_LEAVE';
        statusLabel =
          worker.absences[0].type === AbsenceType.VACATION
            ? 'Vacation'
            : 'Sick Leave';
      } else if (totalAssignedHours === 0) {
        status = 'AVAILABLE';
        statusLabel = 'Available';
      } else if (totalAssignedHours >= 8) {
        status = 'ASSIGNED';
        statusLabel = 'Assigned';
      } else {
        status = 'PARTIALLY_ASSIGNED';
        statusLabel = `Available - also on other tasks (${totalAssignedHours}h)`;
      }

      return new AvailableEmployeeResourceDTO(
        worker.id,
        worker.firstName,
        worker.lastName,
        worker.avatarUrl,
        worker.role,
        status,
        statusLabel,
        isAssignedToPhase,
        assignedHoursOnPhase,
        totalAssignedHours
      );
    }
  );

  const vehicleDtos: AvailableVehicleResourceDTO[] = vehicles.map((vehicle) => {
    const assignment = vehicle.assignments[0];
    const isAssigned = Boolean(assignment);
    const isAssignedToPhase = query.phaseId
      ? assignment?.phaseId === query.phaseId
      : false;

    let status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' = isAssigned
      ? 'ASSIGNED'
      : 'AVAILABLE';
    let assignedProjectName: string | null = null;

    if (isAssigned && !isAssignedToPhase) {
      assignedProjectName = assignment?.phase?.project?.name
        ? `On ${assignment.phase.project.name}`
        : 'Assigned';
    }

    return new AvailableVehicleResourceDTO(
      vehicle.id,
      vehicle.name,
      vehicle.plateNumber,
      vehicle.imageUrl,
      status,
      isAssignedToPhase,
      assignedProjectName
    );
  });

  return new AvailableResourcesDTO(employeeDtos, vehicleDtos);
};

/**
 * Deletes a crew assignment row.
 *
 * @param {TUnassignCrewServiceParams} params - Trusted crew assignment.
 * @returns {Promise<{ id: string }>} Deleted assignment id.
 */
export const unassignCrewService = async ({
  crewAssignment,
}: TUnassignCrewServiceParams): Promise<{ id: string }> => {
  await prisma.crewAssignment.delete({ where: { id: crewAssignment.id } });
  return { id: crewAssignment.id };
};

/**
 * Deletes a vehicle assignment row.
 *
 * @param {TUnassignVehicleServiceParams} params - Trusted vehicle assignment.
 * @returns {Promise<{ id: string }>} Deleted assignment id.
 */
export const unassignVehicleService = async ({
  vehicleAssignment,
}: TUnassignVehicleServiceParams): Promise<{ id: string }> => {
  await prisma.vehicleAssignment.delete({
    where: { id: vehicleAssignment.id },
  });
  return { id: vehicleAssignment.id };
};

/**
 * Computes the weekly workforce capacity and utilization grid matching UI guidelines.
 *
 * @param {TGetWeeklyPlanServiceParams} params - Validated date range query wrapper.
 * @returns {Promise<WeeklyPlanDTO>} Weekly matrix for all workers.
 */
export const getWeeklyPlanService = async ({
  query,
}: TGetWeeklyPlanServiceParams): Promise<WeeklyPlanDTO> => {
  const startDateStr = query.startDate;
  // Default to 4 days after startDate (Monday - Friday 5-day week) if endDate not supplied
  const endDateStr =
    query.endDate ??
    formatUtcDay(
      new Date(toUtcDayDate(startDateStr).getTime() + 4 * 24 * 60 * 60 * 1000)
    );

  const rangeDates = getDatesInRange(startDateStr, endDateStr);
  const rangeStartUtc = toUtcDayDate(startDateStr);
  const rangeEndUtc = toUtcDayEnd(endDateStr);

  const workers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: UserStatus.ACTIVE,
      role: { in: [Role.EMPLOYEE, Role.SITE_MANAGER] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      absences: {
        where: {
          startDate: { lte: rangeEndUtc },
          endDate: { gte: rangeStartUtc },
        },
        select: {
          type: true,
          startDate: true,
          endDate: true,
        },
      },
      crewAssignments: {
        where: {
          date: { gte: rangeStartUtc, lte: rangeEndUtc },
        },
        select: {
          date: true,
          hours: true,
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const employeeRows: WeeklyPlanEmployeeDTO[] = workers.map((worker) => {
    const days: WeeklyPlanDayCellDTO[] = rangeDates.map((dateStr) => {
      const dayStart = toUtcDayDate(dateStr);
      const dayEnd = toUtcDayEnd(dateStr);
      const dayName = getDayName(dateStr);

      const matchingAbsence = worker.absences.find(
        (abs) => abs.startDate <= dayEnd && abs.endDate >= dayStart
      );

      if (matchingAbsence) {
        const isVacation = matchingAbsence.type === AbsenceType.VACATION;
        return new WeeklyPlanDayCellDTO(
          dateStr,
          dayName,
          0,
          8,
          isVacation ? 'VACATION' : 'SICK_LEAVE',
          isVacation ? 'PURPLE' : 'BLUE',
          matchingAbsence.type
        );
      }

      const assignedHours = worker.crewAssignments
        .filter((a) => formatUtcDay(a.date) === dateStr)
        .reduce((sum, a) => sum + Number(a.hours), 0);

      let utilization:
        | 'AVAILABLE'
        | 'PARTIALLY_ASSIGNED'
        | 'HIGHLY_UTILIZED'
        | 'FULLY_ASSIGNED';
      let color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

      if (assignedHours === 0) {
        utilization = 'AVAILABLE';
        color = 'GREEN';
      } else if (assignedHours <= 4) {
        utilization = 'PARTIALLY_ASSIGNED';
        color = 'YELLOW';
      } else if (assignedHours < 8) {
        utilization = 'HIGHLY_UTILIZED';
        color = 'ORANGE';
      } else {
        utilization = 'FULLY_ASSIGNED';
        color = 'RED';
      }

      return new WeeklyPlanDayCellDTO(
        dateStr,
        dayName,
        assignedHours,
        8,
        utilization,
        color,
        null
      );
    });

    return new WeeklyPlanEmployeeDTO(
      worker.id,
      worker.firstName,
      worker.lastName,
      worker.avatarUrl,
      worker.role,
      days
    );
  });

  return new WeeklyPlanDTO(startDateStr, endDateStr, rangeDates, employeeRows);
};

