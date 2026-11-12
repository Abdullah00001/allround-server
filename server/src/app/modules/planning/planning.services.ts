import {
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
  AvailableResourcesDTO,
  DailyPlanPhaseDTO,
} from '@/app/modules/planning/planning.dto';
import {
  toUtcDayDate,
  toUtcDayEnd,
} from '@/app/modules/planning/planning.helpers';
import {
  TAssignCrewServiceParams,
  TAssignVehicleServiceParams,
  TGetAvailableResourcesServiceParams,
  TGetDailyPlanServiceParams,
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
 * Includes IN_PROGRESS / ORDER_CONFIRMED phases whose schedule overlaps the day
 * or that already have crew assigned that day, with day-scoped crew/vehicles.
 *
 * @param {TGetDailyPlanServiceParams} params - Validated query wrapper.
 * @returns {Promise<DailyPlanPhaseDTO[]>} Phase cards grouped for the UI board.
 */
export const getDailyPlanService = async ({
  query,
}: TGetDailyPlanServiceParams): Promise<DailyPlanPhaseDTO[]> => {
  const dayStart = toUtcDayDate(query.date);
  const dayEnd = toUtcDayEnd(query.date);

  const phases = await prisma.projectPhase.findMany({
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
        select: { id: true, name: true, address: true },
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
  });

  return phases.map(DailyPlanPhaseDTO.build);
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
 * Lists employees/site managers and vehicles available for a calendar date.
 * Excludes users with an overlapping Absence and vehicles already assigned that day.
 *
 * @param {TGetAvailableResourcesServiceParams} params - Validated query wrapper.
 * @returns {Promise<AvailableResourcesDTO>} Available employees and vehicles.
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
        absences: {
          none: {
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
        },
      },
      select: userSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        assignments: {
          none: { date: dayStart },
        },
      },
      select: vehicleSelect,
      orderBy: { name: 'asc' },
    }),
  ]);

  return AvailableResourcesDTO.build(employees, vehicles);
};
