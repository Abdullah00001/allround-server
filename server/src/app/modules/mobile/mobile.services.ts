import {
  InspectionStatus,
  PhaseStatus,
  PhaseType,
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
  MobileUpcomingTaskDTO,
  decimalToNumber,
} from '@/app/modules/mobile/mobile.dto';
import {
  getUtcWeekEndExclusive,
  getUtcWeekStart,
} from '@/app/modules/mobile/mobile.helpers';
import { TMobileUserServiceParams } from '@/app/modules/mobile/mobile.types';

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
