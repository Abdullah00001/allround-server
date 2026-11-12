import {
  InspectionStatus,
  PhaseStatus,
  PhaseType,
  Prisma,
  TimeLogStatus,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { calculateNetHours } from '@/app/modules/timelog/timelog.helpers';
import {
  MobileDashboardDTO,
  MobileDashboardStatsDTO,
  MobileMapPinDTO,
  MobileProjectDTO,
  MobileProjectPhaseDTO,
  MobileProfileDTO,
  MobileSyncResultDTO,
  MobileTimeLogDTO,
  MobileUpcomingTaskDTO,
  decimalToNumber,
} from '@/app/modules/mobile/mobile.dto';
import {
  getPeriodRange,
  getUtcWeekEndExclusive,
  getUtcWeekStart,
} from '@/app/modules/mobile/mobile.helpers';
import {
  TGetCrewTimeServiceParams,
  TGetMyTimeLogsServiceParams,
  TManualTimeServiceParams,
  TMobileUserServiceParams,
  TStartTimerServiceParams,
  TStopTimerServiceParams,
  TSyncTimeLogsServiceParams,
} from '@/app/modules/mobile/mobile.types';

const timeLogInclude = {
  breaks: true,
} as const;

const timeLogWithUserInclude = {
  breaks: true,
  user: { select: { id: true, firstName: true, lastName: true } },
} as const;

const ACTIVE_PHASE_STATUSES: PhaseStatus[] = [
  PhaseStatus.IN_PROGRESS,
  PhaseStatus.ORDER_CONFIRMED,
];

/**
 * Collects distinct project ids where the user is a project manager
 * or has at least one crew assignment on a phase.
 *
 * @param {string} userId - Authenticated user UUID.
 * @returns {Promise<string[]>} Distinct project ids.
 */
const getAssignedProjectIds = async (userId: string): Promise<string[]> => {
  const [managerRows, crewRows] = await Promise.all([
    prisma.projectManagerAssignment.findMany({
      where: {
        userId,
        project: { deletedAt: null },
      },
      select: { projectId: true },
    }),
    prisma.crewAssignment.findMany({
      where: {
        userId,
        phase: {
          project: { deletedAt: null },
        },
      },
      select: { phase: { select: { projectId: true } } },
    }),
  ]);

  return [
    ...new Set([
      ...managerRows.map((row) => row.projectId),
      ...crewRows.map((row) => row.phase.projectId),
    ]),
  ];
};

/**
 * Builds the mobile home dashboard: stats, upcoming tasks, and map pins.
 * Scoped strictly to the authenticated user.
 *
 * @param {TMobileUserServiceParams} params - Authenticated user wrapper.
 * @returns {Promise<MobileDashboardDTO>} Dashboard payload for the home screen.
 */
export const getDashboardDataService = async ({
  user,
}: TMobileUserServiceParams): Promise<MobileDashboardDTO> => {
  const userId = user.id;
  const assignedProjectIds = await getAssignedProjectIds(userId);

  const [pendingInspections, upcomingPhases] = await Promise.all([
    prisma.inspection.count({
      where: {
        siteManagerId: userId,
        status: InspectionStatus.PENDING,
        deletedAt: null,
      },
    }),
    prisma.projectPhase.findMany({
      where: {
        status: { in: ACTIVE_PHASE_STATUSES },
        project: { deletedAt: null },
        OR: [
          { crewAssignments: { some: { userId } } },
          { project: { projectManagers: { some: { userId } } } },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { startDate: 'asc' }],
    }),
  ]);

  const upcomingTasks = upcomingPhases.map(
    (phase) =>
      new MobileUpcomingTaskDTO(
        phase.id,
        phase.type,
        phase.status,
        phase.priority,
        phase.startDate ? phase.startDate.toISOString() : null,
        phase.endDate ? phase.endDate.toISOString() : null,
        {
          id: phase.project.id,
          name: phase.project.name,
          address: phase.project.address,
        }
      )
  );

  const pinByProject = new Map<string, MobileMapPinDTO>();
  for (const phase of upcomingPhases) {
    if (pinByProject.has(phase.project.id)) continue;
    pinByProject.set(
      phase.project.id,
      new MobileMapPinDTO(
        phase.project.id,
        phase.project.name,
        decimalToNumber(phase.project.latitude),
        decimalToNumber(phase.project.longitude),
        phase.type as PhaseType
      )
    );
  }

  return new MobileDashboardDTO(
    new MobileDashboardStatsDTO(pendingInspections, assignedProjectIds.length),
    upcomingTasks,
    [...pinByProject.values()]
  );
};

/**
 * Lists distinct projects assigned to the authenticated user for the Projects tab.
 * Includes customer name and only phases relevant to the user (PM → all phases,
 * otherwise crew-assigned phases).
 *
 * @param {TMobileUserServiceParams} params - Authenticated user wrapper.
 * @returns {Promise<MobileProjectDTO[]>} Mobile-safe project rows.
 */
export const getMyProjectsService = async ({
  user,
}: TMobileUserServiceParams): Promise<MobileProjectDTO[]> => {
  const userId = user.id;
  const assignedProjectIds = await getAssignedProjectIds(userId);
  if (assignedProjectIds.length === 0) return [];

  const managedProjectIds = new Set(
    (
      await prisma.projectManagerAssignment.findMany({
        where: { userId, projectId: { in: assignedProjectIds } },
        select: { projectId: true },
      })
    ).map((row) => row.projectId)
  );

  const crewPhaseIds = new Set(
    (
      await prisma.crewAssignment.findMany({
        where: {
          userId,
          phase: { projectId: { in: assignedProjectIds } },
        },
        select: { phaseId: true },
      })
    ).map((row) => row.phaseId)
  );

  const projects = await prisma.project.findMany({
    where: {
      id: { in: assignedProjectIds },
      deletedAt: null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      phases: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return projects.map((project) => {
    const phases = project.phases
      .filter((phase) =>
        managedProjectIds.has(project.id)
          ? true
          : crewPhaseIds.has(phase.id)
      )
      .map(
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

    return new MobileProjectDTO(
      project.id,
      project.name,
      project.address,
      { id: project.customer.id, name: project.customer.name },
      phases
    );
  });
};

/**
 * Builds the mobile profile tab with weekly hour stats and project counters.
 * `hoursThisWeek` uses APPROVED closed time logs in the current UTC ISO week.
 * `completedProjectsCount` counts assigned projects whose phases are all COMPLETED.
 *
 * @param {TMobileUserServiceParams} params - Authenticated user wrapper.
 * @returns {Promise<MobileProfileDTO>} Profile payload for the Profile tab.
 */
export const getProfileStatsService = async ({
  user,
}: TMobileUserServiceParams): Promise<MobileProfileDTO> => {
  const userId = user.id;
  const weekStart = getUtcWeekStart();
  const weekEndExclusive = getUtcWeekEndExclusive(weekStart);
  const assignedProjectIds = await getAssignedProjectIds(userId);

  const [timeLogs, projectsWithPhases] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        userId,
        status: TimeLogStatus.APPROVED,
        endTime: { not: null },
        startTime: {
          gte: weekStart,
          lt: weekEndExclusive,
        },
      },
      include: { breaks: true },
    }),
    assignedProjectIds.length === 0
      ? Promise.resolve([])
      : prisma.project.findMany({
          where: {
            id: { in: assignedProjectIds },
            deletedAt: null,
          },
          select: {
            id: true,
            phases: { select: { status: true } },
          },
        }),
  ]);

  const hoursThisWeek = Number(
    timeLogs
      .reduce((sum, log) => sum + calculateNetHours(log), 0)
      .toFixed(2)
  );

  const completedProjectsCount = projectsWithPhases.filter(
    (project) =>
      project.phases.length > 0 &&
      project.phases.every((phase) => phase.status === PhaseStatus.COMPLETED)
  ).length;

  return MobileProfileDTO.build(
    user,
    hoursThisWeek,
    assignedProjectIds.length,
    completedProjectsCount
  );
};

/**
 * Starts an active timer for the authenticated user on a phase.
 * Assumes no-active-timer middleware already gated concurrent sessions.
 *
 * @param {TStartTimerServiceParams} params - User, phase, and start payload.
 * @returns {Promise<MobileTimeLogDTO>} Created open time log.
 */
export const startTimerService = async ({
  user,
  phase,
  payload,
}: TStartTimerServiceParams): Promise<MobileTimeLogDTO> => {
  const timeLog = await prisma.timeLog.create({
    data: {
      userId: user.id,
      phaseId: phase.id,
      activityType: payload.activityType,
      startTime: new Date(),
      isManual: false,
      status: TimeLogStatus.APPROVED,
      ...(payload.gpsStartLat !== undefined
        ? { gpsStartLat: new Prisma.Decimal(payload.gpsStartLat) }
        : {}),
      ...(payload.gpsStartLng !== undefined
        ? { gpsStartLng: new Prisma.Decimal(payload.gpsStartLng) }
        : {}),
    },
    include: timeLogInclude,
  });

  return MobileTimeLogDTO.build(timeLog);
};

/**
 * Stops an open timer owned by the authenticated user and sets end GPS if provided.
 * Net hours are derived from start/end minus any attached breaks.
 *
 * @param {TStopTimerServiceParams} params - Trusted open time log and stop payload.
 * @returns {Promise<MobileTimeLogDTO>} Closed time log with netHours.
 */
export const stopTimerService = async ({
  timeLog,
  payload,
}: TStopTimerServiceParams): Promise<MobileTimeLogDTO> => {
  const updated = await prisma.timeLog.update({
    where: { id: timeLog.id },
    data: {
      endTime: new Date(),
      ...(payload.gpsEndLat !== undefined
        ? { gpsEndLat: new Prisma.Decimal(payload.gpsEndLat) }
        : {}),
      ...(payload.gpsEndLng !== undefined
        ? { gpsEndLng: new Prisma.Decimal(payload.gpsEndLng) }
        : {}),
    },
    include: timeLogInclude,
  });

  return MobileTimeLogDTO.build(updated);
};

/**
 * Creates a manual time entry requiring admin approval (`PENDING_APPROVAL`).
 * Creates a `TimeLogBreak` when `breakMinutes` is greater than zero.
 *
 * @param {TManualTimeServiceParams} params - User, phase, and manual payload.
 * @returns {Promise<MobileTimeLogDTO>} Created pending time log.
 */
export const createManualTimeService = async ({
  user,
  phase,
  payload,
}: TManualTimeServiceParams): Promise<MobileTimeLogDTO> => {
  const { breakMinutes, startTime, endTime, activityType } = payload;
  const breakEnd =
    breakMinutes > 0
      ? new Date(startTime.getTime() + breakMinutes * 60 * 1000)
      : null;

  const timeLog = await prisma.timeLog.create({
    data: {
      userId: user.id,
      phaseId: phase.id,
      activityType,
      startTime,
      endTime,
      isManual: true,
      status: TimeLogStatus.PENDING_APPROVAL,
      ...(breakMinutes > 0 && breakEnd
        ? {
            breaks: {
              create: [
                {
                  startTime,
                  endTime: breakEnd,
                  durationMinutes: breakMinutes,
                },
              ],
            },
          }
        : {}),
    },
    include: timeLogInclude,
  });

  return MobileTimeLogDTO.build(timeLog);
};

/**
 * Lists the authenticated user's time logs for TODAY, WEEK, or MONTH (UTC).
 *
 * @param {TGetMyTimeLogsServiceParams} params - User and period query.
 * @returns {Promise<MobileTimeLogDTO[]>} Period-filtered time logs.
 */
export const getMyTimeLogsService = async ({
  user,
  query,
}: TGetMyTimeLogsServiceParams): Promise<MobileTimeLogDTO[]> => {
  const { start, endExclusive } = getPeriodRange(query.period);

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      userId: user.id,
      startTime: {
        gte: start,
        lt: endExclusive,
      },
    },
    include: timeLogInclude,
    orderBy: { startTime: 'desc' },
  });

  return timeLogs.map(MobileTimeLogDTO.build);
};

/**
 * Lists all time logs for a phase for an authorized site manager.
 * Assumes role and project-assignment middlewares already passed.
 *
 * @param {TGetCrewTimeServiceParams} params - Site manager and trusted phase.
 * @returns {Promise<MobileTimeLogDTO[]>} Phase time logs with user details.
 */
export const getCrewTimeService = async ({
  phase,
}: TGetCrewTimeServiceParams): Promise<MobileTimeLogDTO[]> => {
  const timeLogs = await prisma.timeLog.findMany({
    where: { phaseId: phase.id },
    include: timeLogWithUserInclude,
    orderBy: { startTime: 'desc' },
  });

  return timeLogs.map(MobileTimeLogDTO.build);
};

/**
 * Bulk-syncs offline time logs using `clientSyncId` for idempotency.
 * Existing sync ids are skipped; new closed logs are stored as trusted
 * non-manual APPROVED entries (with optional breaks).
 *
 * @param {TSyncTimeLogsServiceParams} params - User and sync payload.
 * @returns {Promise<MobileSyncResultDTO>} Created/skipped counts and created logs.
 */
export const syncTimeLogsService = async ({
  user,
  payload,
}: TSyncTimeLogsServiceParams): Promise<MobileSyncResultDTO> => {
  const clientSyncIds = payload.logs.map((log) => log.clientSyncId);
  const existing = await prisma.timeLog.findMany({
    where: { clientSyncId: { in: clientSyncIds } },
    select: { clientSyncId: true },
  });
  const existingIds = new Set(
    existing
      .map((row) => row.clientSyncId)
      .filter((id): id is string => !!id)
  );

  const createdLogs: MobileTimeLogDTO[] = [];
  let skipped = 0;

  for (const log of payload.logs) {
    if (existingIds.has(log.clientSyncId)) {
      skipped += 1;
      continue;
    }

    const breakEnd =
      log.breakMinutes > 0
        ? new Date(log.startTime.getTime() + log.breakMinutes * 60 * 1000)
        : null;

    const created = await prisma.timeLog.create({
      data: {
        userId: user.id,
        phaseId: log.phaseId,
        activityType: log.activityType,
        startTime: log.startTime,
        endTime: log.endTime,
        clientSyncId: log.clientSyncId,
        isManual: false,
        status: TimeLogStatus.APPROVED,
        ...(log.breakMinutes > 0 && breakEnd
          ? {
              breaks: {
                create: [
                  {
                    startTime: log.startTime,
                    endTime: breakEnd,
                    durationMinutes: log.breakMinutes,
                  },
                ],
              },
            }
          : {}),
      },
      include: timeLogInclude,
    });

    existingIds.add(log.clientSyncId);
    createdLogs.push(MobileTimeLogDTO.build(created));
  }

  return new MobileSyncResultDTO(createdLogs.length, skipped, createdLogs);
};
