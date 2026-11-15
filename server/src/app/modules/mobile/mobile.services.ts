import {
  AttachmentCategory,
  CustomerCategory,
  InspectionStatus,
  Language,
  PhaseStatus,
  PhaseType,
  Priority,
  Prisma,
  Role,
  TimeLogStatus,
  User,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  aggregateLoggedHours,
  TTimeLogWithBreaks,
} from '@/app/modules/project/project.helpers';
import { calculateNetHours } from '@/app/modules/timelog/timelog.helpers';
import {
  getProjectDto,
  MobileAttachmentDTO,
  MobileConfigDTO,
  MobileCrewBreakdownDTO,
  MobileCrewTimeDTO,
  MobileDashboardDTO,
  MobileDashboardStatsDTO,
  MobileHoursByActivityDTO,
  MobileInspectionDTO,
  MobileLegalContentDTO,
  MobileManagedPhaseDTO,
  MobileMapPinDTO,
  MobileMapProjectDTO,
  MobileMeasurementDTO,
  MobilePhaseDatesDTO,
  MobileProjectDTO,
  MobileProjectFilterOptionsDTO,
  MobileProjectNoteDTO,
  MobileProjectSettingsDTO,
  MobileProjectTaskDTO,
  MobileProjectTasksListDTO,
  MobileProfileDTO,
  MobileScheduleDayDTO,
  MobileSchedulePhaseDTO,
  MobileStartTimerDTO,
  MobileSyncResultDTO,
  MobileTimeLogDTO,
  MobileUpcomingTaskDTO,
  decimalToNumber,
} from '@/app/modules/mobile/mobile.dto';
import {
  deriveTaskTitle,
  extractCityFromAddress,
  getPeriodRange,
  getUtcDayEndExclusive,
  getUtcDayStart,
  getUtcWeekEndExclusive,
  getUtcWeekStart,
} from '@/app/modules/mobile/mobile.helpers';
import {
  TCompleteInspectionServiceParams,
  TCreateMeasurementServiceParams,
  TCreateProjectAttachmentServiceParams,
  TCreateProjectNoteServiceParams,
  TCreateProjectTaskServiceParams,
  TDeleteMeasurementServiceParams,
  TDeleteProjectAttachmentServiceParams,
  TDeleteProjectNoteServiceParams,
  TGetCrewTimeServiceParams,
  TGetMapServiceParams,
  TGetMobileInspectionServiceParams,
  TGetMyProjectsServiceParams,
  TGetMyTimeLogsServiceParams,
  TGetScheduleServiceParams,
  TListMobileInspectionsServiceParams,
  TListMobilePhasesServiceParams,
  TManualTimeServiceParams,
  TMobileProjectServiceParams,
  TMobileUserServiceParams,
  TProjectTaskServiceParams,
  TStartTimerServiceParams,
  TStopTimerServiceParams,
  TSyncTimeLogsServiceParams,
  TUpdateMobilePhaseStatusServiceParams,
  TUpdateMobileProjectServiceParams,
  TUpdatePhaseDatesServiceParams,
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
 * Known `CompanyProfile.siteManagerAccessRule` values.
 * Stored as plain strings on the profile row (not a Prisma enum).
 */
const SiteManagerAccessRule = {
  RESTRICT_TO_ASSIGNED: 'RESTRICT_TO_ASSIGNED',
  GLOBAL_ACCESS: 'GLOBAL_ACCESS',
} as const;

const upcomingPhaseProjectSelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
} as const;

/**
 * Loads the singleton company profile (`id = "global"`).
 * Missing rows are treated as the fail-safe restricted mode by callers.
 *
 * @returns {Promise<{ siteManagerAccessRule: string } | null>} Profile or null.
 */
const getCompanyProfile = async (): Promise<{
  siteManagerAccessRule: string;
} | null> => {
  return prisma.companyProfile.findUnique({
    where: { id: 'global' },
    select: { siteManagerAccessRule: true },
  });
};

/**
 * Resolves whether a site manager may see all projects/phases company-wide.
 * Employees always return `false`. A missing company profile defaults to
 * `RESTRICT_TO_ASSIGNED` (no global access).
 *
 * @param {User} user - Authenticated mobile user.
 * @returns {Promise<boolean>} `true` only for SITE_MANAGER + GLOBAL_ACCESS.
 */
const hasSiteManagerGlobalAccess = async (user: User): Promise<boolean> => {
  if (user.role !== Role.SITE_MANAGER) return false;

  const profile = await getCompanyProfile();
  if (!profile) return false;

  return (
    profile.siteManagerAccessRule === SiteManagerAccessRule.GLOBAL_ACCESS
  );
};

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
 * Counts distinct non-deleted projects that have at least one active phase
 * (`IN_PROGRESS` or `ORDER_CONFIRMED`). Used as the dashboard/profile
 * "active projects" stat for globally scoped site managers.
 *
 * @returns {Promise<number>} Distinct active project count.
 */
const countActiveProjects = async (): Promise<number> => {
  const rows = await prisma.project.findMany({
    where: {
      deletedAt: null,
      phases: {
        some: {
          status: { in: ACTIVE_PHASE_STATUSES },
        },
      },
    },
    select: { id: true },
  });

  return rows.length;
};

/**
 * Formats a Date as a UTC calendar day key `YYYY-MM-DD`.
 *
 * @param {Date} value - Instant to format.
 * @returns {string} UTC date key.
 */
const toUtcDateKey = (value: Date): string => {
  return value.toISOString().slice(0, 10);
};

/**
 * Loads approved closed time logs for the given projects and returns a map of
 * projectId → total net logged hours.
 *
 * @param {string[]} projectIds - Project UUIDs to aggregate.
 * @returns {Promise<Map<string, number>>} Per-project logged hour totals.
 */
const getLoggedHoursByProjectId = async (
  projectIds: string[]
): Promise<Map<string, number>> => {
  const totals = new Map<string, number>();
  if (projectIds.length === 0) return totals;

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      status: TimeLogStatus.APPROVED,
      endTime: { not: null },
      phase: { projectId: { in: projectIds } },
    },
    include: {
      breaks: true,
      phase: { select: { projectId: true } },
    },
  });

  const byProject = new Map<string, TTimeLogWithBreaks[]>();
  for (const log of timeLogs) {
    const projectId = log.phase.projectId;
    const bucket = byProject.get(projectId) ?? [];
    bucket.push(log);
    byProject.set(projectId, bucket);
  }

  for (const [projectId, logs] of byProject.entries()) {
    totals.set(projectId, aggregateLoggedHours(logs).totalLoggedHours);
  }

  return totals;
};

/**
 * Loads mobile app configuration for Settings / Legal screens.
 * Missing company profile falls back to safe defaults
 * (`DE`, `[DE, EN]`, manual time allowed).
 *
 * @returns {Promise<MobileConfigDTO>} Config payload for the authenticated mobile client.
 */
export const getMobileConfigService = async (): Promise<MobileConfigDTO> => {
  const [profile, legalRows] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: 'global' },
      select: {
        defaultLanguage: true,
        enabledLanguages: true,
        allowEmployeeManualTime: true,
      },
    }),
    prisma.legalContent.findMany({
      orderBy: { legalContentType: 'asc' },
      select: {
        legalContentType: true,
        content: true,
        updatedAt: true,
      },
    }),
  ]);

  const legalContents = legalRows.map(
    (row) =>
      new MobileLegalContentDTO(
        row.legalContentType,
        row.content,
        row.updatedAt.toISOString()
      )
  );

  return new MobileConfigDTO(
    profile?.defaultLanguage ?? Language.DE,
    profile?.enabledLanguages?.length
      ? profile.enabledLanguages
      : [Language.DE, Language.EN],
    profile?.allowEmployeeManualTime ?? true,
    legalContents
  );
};

/**
 * Builds the mobile home dashboard: stats, upcoming tasks, and map pins.
 * Respects `CompanyProfile.siteManagerAccessRule`: SITE_MANAGER + GLOBAL_ACCESS
 * sees all active projects/phases; otherwise scopes to PM/crew assignments.
 * Pending inspections always remain filtered by `siteManagerId = user.id`.
 *
 * @param {TMobileUserServiceParams} params - Authenticated user wrapper.
 * @returns {Promise<MobileDashboardDTO>} Dashboard payload for the home screen.
 */
export const getDashboardDataService = async ({
  user,
}: TMobileUserServiceParams): Promise<MobileDashboardDTO> => {
  const userId = user.id;
  const globalAccess = await hasSiteManagerGlobalAccess(user);

  const [pendingInspections, upcomingPhases, activeProjectsCount] =
    await Promise.all([
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
          ...(globalAccess
            ? {}
            : {
                OR: [
                  { crewAssignments: { some: { userId } } },
                  { project: { projectManagers: { some: { userId } } } },
                ],
              }),
        },
        include: {
          project: {
            select: upcomingPhaseProjectSelect,
          },
        },
        orderBy: [{ priority: 'asc' }, { startDate: 'asc' }],
      }),
      globalAccess
        ? countActiveProjects()
        : getAssignedProjectIds(userId).then((ids) => ids.length),
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
    new MobileDashboardStatsDTO(pendingInspections, activeProjectsCount),
    upcomingTasks,
    [...pinByProject.values()]
  );
};

/**
 * Builds Prisma `where` filters for deep project list filtering.
 *
 * @param {TGetMyProjectsServiceParams['query']} query - Validated list filters.
 * @returns {Prisma.ProjectWhereInput} Additional where clauses (AND-merged by caller).
 */
const buildProjectListFilters = (
  query: TGetMyProjectsServiceParams['query']
): Prisma.ProjectWhereInput => {
  const and: Prisma.ProjectWhereInput[] = [];

  if (query.phaseType) {
    and.push({ phases: { some: { type: query.phaseType } } });
  }
  if (query.priority) {
    and.push({ phases: { some: { priority: query.priority } } });
  }
  if (query.category) {
    and.push({ customer: { category: query.category, deletedAt: null } });
  }
  if (query.city) {
    and.push({
      OR: [
        { address: { contains: query.city, mode: 'insensitive' } },
        {
          customer: {
            address: { contains: query.city, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
};

/**
 * Earliest non-null phase startDate used as a next-inspection proxy for sorting.
 *
 * @param {{ startDate: Date | null }[]} phases - Project phases.
 * @returns {number} Epoch ms or `Number.POSITIVE_INFINITY` when none set.
 */
const nextInspectionSortKey = (
  phases: Array<{ startDate: Date | null }>
): number => {
  const timestamps = phases
    .map((phase) => phase.startDate?.getTime())
    .filter((value): value is number => typeof value === 'number');
  if (timestamps.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...timestamps);
};

/**
 * Lists projects for the mobile Projects tab with optional deep filters.
 * SITE_MANAGER + `GLOBAL_ACCESS` returns every non-deleted project with all
 * phases. Otherwise returns assignment-scoped projects (PM → all phases on
 * managed projects; crew → only assigned phases).
 * Project rows are built via `getProjectDto` so site managers receive
 * budget/logged/profitability fields while employees do not.
 *
 * @param {TGetMyProjectsServiceParams} params - Authenticated user and filters.
 * @returns {Promise<MobileProjectDTO[]>} Role-aware mobile project rows.
 */
export const getMyProjectsService = async ({
  user,
  query,
}: TGetMyProjectsServiceParams): Promise<MobileProjectDTO[]> => {
  const userId = user.id;
  const globalAccess = await hasSiteManagerGlobalAccess(user);
  const filterWhere = buildProjectListFilters(query);
  const sortBy = query.sortBy ?? 'newest';

  type TProjectListRow = {
    id: string;
    name: string;
    address: string;
    budgetedHours: Prisma.Decimal | number;
    updatedAt: Date;
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

  let scopedProjects: TProjectListRow[] = [];

  if (globalAccess) {
    scopedProjects = await prisma.project.findMany({
      where: { deletedAt: null, ...filterWhere },
      include: {
        customer: { select: { id: true, name: true } },
        phases: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  } else {
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
        ...filterWhere,
      },
      include: {
        customer: { select: { id: true, name: true } },
        phases: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    scopedProjects = projects.map((project) => ({
      ...project,
      phases: managedProjectIds.has(project.id)
        ? project.phases
        : project.phases.filter((phase) => crewPhaseIds.has(phase.id)),
    }));
  }

  if (sortBy === 'nameAZ') {
    scopedProjects.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'nextInspectionDate') {
    scopedProjects.sort(
      (a, b) =>
        nextInspectionSortKey(a.phases) - nextInspectionSortKey(b.phases)
    );
  } else {
    scopedProjects.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  const loggedByProject = await getLoggedHoursByProjectId(
    scopedProjects.map((project) => project.id)
  );

  return scopedProjects.map((project) =>
    getProjectDto(project, user.role, loggedByProject.get(project.id) ?? 0)
  );
};

/**
 * Builds the mobile profile tab with weekly hour stats and project counters.
 * `hoursThisWeek` uses APPROVED closed time logs in the current UTC ISO week.
 * Project counters respect site-manager global access: under GLOBAL_ACCESS the
 * assigned/active count is distinct projects with an active phase; otherwise
 * it uses assignment-scoped project ids. `completedProjectsCount` follows the
 * same project scope.
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
  const globalAccess = await hasSiteManagerGlobalAccess(user);

  const assignedProjectIds = globalAccess
    ? null
    : await getAssignedProjectIds(userId);

  const [timeLogs, activeProjectsCount, projectsWithPhases] = await Promise.all(
    [
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
      globalAccess
        ? countActiveProjects()
        : Promise.resolve(assignedProjectIds!.length),
      globalAccess
        ? prisma.project.findMany({
            where: { deletedAt: null },
            select: {
              id: true,
              phases: { select: { status: true } },
            },
          })
        : assignedProjectIds!.length === 0
          ? Promise.resolve([])
          : prisma.project.findMany({
              where: {
                id: { in: assignedProjectIds! },
                deletedAt: null,
              },
              select: {
                id: true,
                phases: { select: { status: true } },
              },
            }),
    ]
  );

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
    activeProjectsCount,
    completedProjectsCount
  );
};

/**
 * Starts an active timer for the authenticated user on a phase.
 * Assumes no-active-timer middleware already gated concurrent sessions.
 * Returns the open time log plus a role-aware project DTO for navigation
 * and (for site managers) budget/profitability UI.
 *
 * @param {TStartTimerServiceParams} params - User, phase, and start payload.
 * @returns {Promise<MobileStartTimerDTO>} Open time log with project context.
 */
export const startTimerService = async ({
  user,
  phase,
  payload,
}: TStartTimerServiceParams): Promise<MobileStartTimerDTO> => {
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

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: phase.projectId },
    include: {
      customer: { select: { id: true, name: true } },
      phases: { orderBy: { createdAt: 'desc' } },
    },
  });

  const loggedByProject = await getLoggedHoursByProjectId([project.id]);

  return new MobileStartTimerDTO(
    MobileTimeLogDTO.build(timeLog),
    getProjectDto(project, user.role, loggedByProject.get(project.id) ?? 0)
  );
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
 * Aggregates crew time for a managed project (optional UTC calendar-day filter).
 * Assumes site-manager role + project existence/access middlewares already passed.
 * Includes per-activity totals, per-user breakdown with sync flags (`!!clientSyncId`),
 * and the underlying time-log details.
 *
 * @param {TGetCrewTimeServiceParams} params - Site manager, project, and query.
 * @returns {Promise<MobileCrewTimeDTO>} Aggregated crew-time payload.
 */
export const getCrewTimeService = async ({
  project,
  query,
}: TGetCrewTimeServiceParams): Promise<MobileCrewTimeDTO> => {
  const dateFilter = query.date
    ? (() => {
        const start = getUtcDayStart(query.date);
        return {
          startTime: {
            gte: start,
            lt: getUtcDayEndExclusive(start),
          },
        };
      })()
    : {};

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      phase: { projectId: project.id },
      ...dateFilter,
    },
    include: timeLogWithUserInclude,
    orderBy: { startTime: 'desc' },
  });

  const { totalLoggedHours, hoursByActivity } = aggregateLoggedHours(
    timeLogs as TTimeLogWithBreaks[]
  );

  const byUser = new Map<
    string,
    {
      user: { id: string; firstName: string; lastName: string };
      hours: number;
      logs: typeof timeLogs;
    }
  >();

  for (const log of timeLogs) {
    const existing = byUser.get(log.userId);
    const hours = calculateNetHours(log);
    if (existing) {
      existing.hours += hours;
      existing.logs.push(log);
      continue;
    }

    byUser.set(log.userId, {
      user: {
        id: log.user.id,
        firstName: log.user.firstName,
        lastName: log.user.lastName,
      },
      hours,
      logs: [log],
    });
  }

  const crewBreakdown = [...byUser.values()].map(
    (row) =>
      new MobileCrewBreakdownDTO(
        row.user,
        Number(row.hours.toFixed(2)),
        row.logs.length > 0 && row.logs.every((log) => !!log.clientSyncId)
      )
  );

  return new MobileCrewTimeDTO(
    totalLoggedHours,
    hoursByActivity.map(
      (row) => new MobileHoursByActivityDTO(row.activityType, row.hours)
    ),
    crewBreakdown,
    timeLogs.map(MobileTimeLogDTO.build)
  );
};

/**
 * Builds the Site Manager calendar schedule: phases overlapping the query
 * window, grouped by UTC calendar date. Respects `siteManagerAccessRule`
 * (GLOBAL_ACCESS → all projects; otherwise PM/crew assignments). Phases with
 * null `startDate` or `endDate` are excluded.
 *
 * @param {TGetScheduleServiceParams} params - Site manager and date window.
 * @returns {Promise<MobileScheduleDayDTO[]>} Date-grouped schedule rows.
 */
export const getScheduleService = async ({
  user,
  query,
}: TGetScheduleServiceParams): Promise<MobileScheduleDayDTO[]> => {
  const globalAccess = await hasSiteManagerGlobalAccess(user);
  const rangeStart = getUtcDayStart(query.startDate);
  const rangeEndExclusive = getUtcDayEndExclusive(getUtcDayStart(query.endDate));

  const phases = await prisma.projectPhase.findMany({
    where: {
      startDate: { not: null, lte: query.endDate },
      endDate: { not: null, gte: query.startDate },
      project: { deletedAt: null },
      ...(globalAccess
        ? {}
        : {
            OR: [
              { crewAssignments: { some: { userId: user.id } } },
              { project: { projectManagers: { some: { userId: user.id } } } },
            ],
          }),
    },
    include: {
      project: {
        select: { id: true, name: true, address: true },
      },
    },
    orderBy: [{ startDate: 'asc' }, { priority: 'asc' }],
  });

  const byDate = new Map<string, MobileSchedulePhaseDTO[]>();

  for (const phase of phases) {
    if (!phase.startDate || !phase.endDate) continue;

    const overlapStart = new Date(
      Math.max(getUtcDayStart(phase.startDate).getTime(), rangeStart.getTime())
    );
    const overlapEnd = new Date(
      Math.min(
        getUtcDayStart(phase.endDate).getTime(),
        getUtcDayStart(query.endDate).getTime()
      )
    );

    for (
      let cursor = overlapStart.getTime();
      cursor <= overlapEnd.getTime();
      cursor += 24 * 60 * 60 * 1000
    ) {
      const dateKey = toUtcDateKey(new Date(cursor));
      const bucket = byDate.get(dateKey) ?? [];
      bucket.push(
        new MobileSchedulePhaseDTO(
          phase.id,
          phase.type,
          phase.status,
          phase.priority,
          phase.startDate.toISOString(),
          phase.endDate.toISOString(),
          {
            id: phase.project.id,
            name: phase.project.name,
            address: phase.project.address,
          }
        )
      );
      byDate.set(dateKey, bucket);
    }
  }

  // Ensure empty day buckets across the requested inclusive window.
  for (
    let cursor = rangeStart.getTime();
    cursor < rangeEndExclusive.getTime();
    cursor += 24 * 60 * 60 * 1000
  ) {
    const dateKey = toUtcDateKey(new Date(cursor));
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayPhases]) => new MobileScheduleDayDTO(date, dayPhases));
};

/**
 * Builds Site Manager map pins for projects with active phases.
 * Respects `siteManagerAccessRule` and optional `?type=` phase-type filter.
 *
 * @param {TGetMapServiceParams} params - Site manager and optional type filter.
 * @returns {Promise<MobileMapProjectDTO[]>} Distinct project map pins.
 */
export const getMapDataService = async ({
  user,
  query,
}: TGetMapServiceParams): Promise<MobileMapProjectDTO[]> => {
  const globalAccess = await hasSiteManagerGlobalAccess(user);

  const phases = await prisma.projectPhase.findMany({
    where: {
      status: { in: ACTIVE_PHASE_STATUSES },
      ...(query.type ? { type: query.type } : {}),
      project: { deletedAt: null },
      ...(globalAccess
        ? {}
        : {
            OR: [
              { crewAssignments: { some: { userId: user.id } } },
              { project: { projectManagers: { some: { userId: user.id } } } },
            ],
          }),
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: [{ priority: 'asc' }, { startDate: 'asc' }],
  });

  const pinByProject = new Map<string, MobileMapProjectDTO>();
  for (const phase of phases) {
    if (pinByProject.has(phase.project.id)) continue;
    pinByProject.set(
      phase.project.id,
      new MobileMapProjectDTO(
        phase.project.id,
        phase.project.name,
        decimalToNumber(phase.project.latitude),
        decimalToNumber(phase.project.longitude),
        phase.type
      )
    );
  }

  return [...pinByProject.values()];
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

/**
 * Lists inspections assigned to the authenticated site manager
 * in `PENDING` or `SURVEY_DONE` status.
 *
 * @param {TListMobileInspectionsServiceParams} params - Authenticated site manager.
 * @returns {Promise<MobileInspectionDTO[]>} Assigned inspections for the survey list.
 */
export const listMobileInspectionsService = async ({
  user,
}: TListMobileInspectionsServiceParams): Promise<MobileInspectionDTO[]> => {
  const inspections = await prisma.inspection.findMany({
    where: {
      siteManagerId: user.id,
      deletedAt: null,
      status: {
        in: [InspectionStatus.PENDING, InspectionStatus.SURVEY_DONE],
      },
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { appointmentDate: 'asc' },
  });

  return inspections.map((inspection) => MobileInspectionDTO.build(inspection));
};

/**
 * Loads one assigned inspection for the survey form.
 * Assumes existence + assignment middlewares already passed.
 *
 * @param {TGetMobileInspectionServiceParams} params - Trusted inspection wrapper.
 * @returns {Promise<MobileInspectionDTO>} Inspection detail DTO.
 */
export const getMobileInspectionByIdService = async ({
  inspection,
}: TGetMobileInspectionServiceParams): Promise<MobileInspectionDTO> => {
  const record = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspection.id },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  return MobileInspectionDTO.build(record);
};

/**
 * Completes an inspection survey: saves scaffold specs, optional access notes,
 * survey photos as `Attachment` rows, and optionally converts to a Project.
 * When `convertToProject` is true the inspection ends as `CONVERTED`; otherwise `SURVEY_DONE`.
 * Assumes pending + assignment middlewares already passed.
 *
 * @param {TCompleteInspectionServiceParams} params - Trusted inspection and payload.
 * @returns {Promise<MobileInspectionDTO>} Updated inspection DTO (optional converted project).
 */
export const completeMobileInspectionService = async ({
  inspection,
  payload,
}: TCompleteInspectionServiceParams): Promise<MobileInspectionDTO> => {
  const convert = payload.convertToProject === true;
  const projectName = payload.projectName?.trim() || inspection.siteTitle;
  const phaseType = payload.phaseType ?? PhaseType.ERECTION;

  const result = await prisma.$transaction(async (tx) => {
    if (payload.photos && payload.photos.length > 0) {
      await tx.attachment.createMany({
        data: payload.photos.map((photo) => ({
          url: photo.url,
          fileType: photo.fileType,
          category: AttachmentCategory.PHOTO,
          inspectionId: inspection.id,
        })),
      });
    }

    if (!convert) {
      const updated = await tx.inspection.update({
        where: { id: inspection.id },
        data: {
          scaffoldArea: new Prisma.Decimal(payload.scaffoldArea),
          scaffoldHeight: new Prisma.Decimal(payload.scaffoldHeight),
          scaffoldType: payload.scaffoldType,
          siteAccessInstructions: payload.siteAccessInstructions,
          specialRequirements: payload.specialRequirements,
          status: InspectionStatus.SURVEY_DONE,
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
      });
      return { inspection: updated, project: null as { id: string; name: string } | null };
    }

    const project = await tx.project.create({
      data: {
        customerId: inspection.customerId,
        name: projectName,
        address: inspection.address,
        scaffoldArea: new Prisma.Decimal(payload.scaffoldArea),
        siteAccessNotes: payload.siteAccessInstructions,
      },
    });

    await tx.projectMeasurement.create({
      data: {
        projectId: project.id,
        length: new Prisma.Decimal(0),
        height: new Prisma.Decimal(payload.scaffoldHeight),
        quantity: new Prisma.Decimal(1),
        area: new Prisma.Decimal(payload.scaffoldArea),
        scaffoldType: payload.scaffoldType,
      },
    });

    await tx.projectPhase.create({
      data: {
        projectId: project.id,
        type: phaseType,
        status: PhaseStatus.ENQUIRY,
      },
    });

    if (inspection.siteManagerId) {
      await tx.projectManagerAssignment.create({
        data: {
          projectId: project.id,
          userId: inspection.siteManagerId,
        },
      });
    }

    const updated = await tx.inspection.update({
      where: { id: inspection.id },
      data: {
        scaffoldArea: new Prisma.Decimal(payload.scaffoldArea),
        scaffoldHeight: new Prisma.Decimal(payload.scaffoldHeight),
        scaffoldType: payload.scaffoldType,
        siteAccessInstructions: payload.siteAccessInstructions,
        specialRequirements: payload.specialRequirements,
        status: InspectionStatus.CONVERTED,
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });

    return {
      inspection: updated,
      project: { id: project.id, name: project.name },
    };
  });

  return MobileInspectionDTO.build(
    result.inspection,
    result.project ?? undefined
  );
};

/**
 * Lists project phases for projects managed by the authenticated site manager.
 *
 * @param {TListMobilePhasesServiceParams} params - Authenticated site manager.
 * @returns {Promise<MobileManagedPhaseDTO[]>} Managed phase board rows.
 */
export const listMobilePhasesService = async ({
  user,
}: TListMobilePhasesServiceParams): Promise<MobileManagedPhaseDTO[]> => {
  const phases = await prisma.projectPhase.findMany({
    where: {
      project: {
        deletedAt: null,
        projectManagers: {
          some: { userId: user.id },
        },
      },
    },
    include: {
      project: {
        select: { id: true, name: true, address: true },
      },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  return phases.map(
    (phase) =>
      new MobileManagedPhaseDTO(
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
};

/**
 * Updates a managed phase status from the mobile board and writes an audit log.
 * Sets `endDate` to now when transitioning to `COMPLETED`.
 *
 * @param {TUpdateMobilePhaseStatusServiceParams} params - Actor, phase, and payload.
 * @returns {Promise<MobileManagedPhaseDTO>} Updated phase DTO.
 */
export const updateMobilePhaseStatusService = async ({
  user,
  phase,
  payload,
}: TUpdateMobilePhaseStatusServiceParams): Promise<MobileManagedPhaseDTO> => {
  const oldStatus = phase.status;

  const updated = await prisma.$transaction(async (tx) => {
    const nextPhase = await tx.projectPhase.update({
      where: { id: phase.id },
      data: {
        status: payload.status,
        ...(payload.status === PhaseStatus.COMPLETED
          ? { endDate: new Date() }
          : {}),
      },
      include: {
        project: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    if (oldStatus !== payload.status) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: phase.projectId,
          action: 'MOBILE_PHASE_STATUS_UPDATED',
          details: JSON.stringify({
            from: oldStatus,
            to: payload.status,
          }),
        },
      });
    }

    return nextPhase;
  });

  return new MobileManagedPhaseDTO(
    updated.id,
    updated.type,
    updated.status,
    updated.priority,
    updated.startDate ? updated.startDate.toISOString() : null,
    updated.endDate ? updated.endDate.toISOString() : null,
    {
      id: updated.project.id,
      name: updated.project.name,
      address: updated.project.address,
    }
  );
};

/**
 * Returns filter-modal options for the Site Manager projects list.
 * Cities are distinct tokens parsed from project and customer addresses within
 * the caller's accessible project scope.
 *
 * @param {TMobileUserServiceParams} params - Authenticated site manager.
 * @returns {Promise<MobileProjectFilterOptionsDTO>} Filter option bags.
 */
export const getProjectFilterOptionsService = async ({
  user,
}: TMobileUserServiceParams): Promise<MobileProjectFilterOptionsDTO> => {
  const globalAccess = await hasSiteManagerGlobalAccess(user);

  const projects = await prisma.project.findMany({
    where: globalAccess
      ? { deletedAt: null }
      : {
          deletedAt: null,
          id: { in: await getAssignedProjectIds(user.id) },
        },
    select: {
      address: true,
      customer: { select: { address: true } },
    },
  });

  const citySet = new Set<string>();
  for (const project of projects) {
    const fromProject = extractCityFromAddress(project.address);
    const fromCustomer = extractCityFromAddress(project.customer.address);
    if (fromProject) citySet.add(fromProject);
    if (fromCustomer) citySet.add(fromCustomer);
  }

  return new MobileProjectFilterOptionsDTO(
    Object.values(PhaseType),
    [...citySet].sort((a, b) => a.localeCompare(b)),
    Object.values(Priority),
    Object.values(CustomerCategory),
    ['newest', 'nextInspectionDate', 'nameAZ']
  );
};

/**
 * Lists open and completed tasks for a project, including assignee details.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileProjectTasksListDTO>} Open and completed task lists.
 */
export const listProjectTasksService = async ({
  project,
}: TMobileProjectServiceParams): Promise<MobileProjectTasksListDTO> => {
  const tasks = await prisma.projectTask.findMany({
    where: { projectId: project.id },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const open = tasks
    .filter((task) => !task.isCompleted)
    .map((task) => MobileProjectTaskDTO.build(task));
  const completed = tasks
    .filter((task) => task.isCompleted)
    .map((task) => MobileProjectTaskDTO.build(task));

  return new MobileProjectTasksListDTO(open, completed);
};

/**
 * Creates a project task for the Site Manager task board.
 * `title` is derived from the first line of `description`.
 *
 * @param {TCreateProjectTaskServiceParams} params - Project, actor, and payload.
 * @returns {Promise<MobileProjectTaskDTO>} Created task DTO.
 */
export const createProjectTaskService = async ({
  project,
  payload,
}: TCreateProjectTaskServiceParams): Promise<MobileProjectTaskDTO> => {
  const task = await prisma.projectTask.create({
    data: {
      projectId: project.id,
      title: deriveTaskTitle(payload.description),
      description: payload.description,
      employeeId: payload.employeeId,
      priority: payload.priority,
      dueDate: payload.dueDate,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  return MobileProjectTaskDTO.build(task);
};

/**
 * Toggles a task between completed and open.
 *
 * @param {TProjectTaskServiceParams} params - Trusted task.
 * @returns {Promise<MobileProjectTaskDTO>} Updated task DTO.
 */
export const toggleProjectTaskService = async ({
  task,
}: TProjectTaskServiceParams): Promise<MobileProjectTaskDTO> => {
  const updated = await prisma.projectTask.update({
    where: { id: task.id },
    data: { isCompleted: !task.isCompleted },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  return MobileProjectTaskDTO.build(updated);
};

/**
 * Deletes a project task.
 *
 * @param {TProjectTaskServiceParams} params - Trusted task.
 * @returns {Promise<{ id: string }>} Deleted task id.
 */
export const deleteProjectTaskService = async ({
  task,
}: TProjectTaskServiceParams): Promise<{ id: string }> => {
  await prisma.projectTask.delete({ where: { id: task.id } });
  return { id: task.id };
};

/**
 * Lists measurement line items for a project.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileMeasurementDTO[]>} Measurement rows.
 */
export const listProjectMeasurementsService = async ({
  project,
}: TMobileProjectServiceParams): Promise<MobileMeasurementDTO[]> => {
  const rows = await prisma.projectMeasurement.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => MobileMeasurementDTO.build(row));
};

/**
 * Creates a measurement line item, computes area, and refreshes project scaffoldArea.
 *
 * @param {TCreateMeasurementServiceParams} params - Project and payload.
 * @returns {Promise<MobileMeasurementDTO>} Created measurement DTO.
 */
export const createProjectMeasurementService = async ({
  project,
  payload,
}: TCreateMeasurementServiceParams): Promise<MobileMeasurementDTO> => {
  const area = payload.length * payload.height * payload.quantity;

  const measurement = await prisma.$transaction(async (tx) => {
    const created = await tx.projectMeasurement.create({
      data: {
        projectId: project.id,
        position: payload.position,
        length: new Prisma.Decimal(payload.length),
        height: new Prisma.Decimal(payload.height),
        quantity: new Prisma.Decimal(payload.quantity),
        unit: payload.unit,
        remark: payload.remark,
        area: new Prisma.Decimal(area),
      },
    });

    const aggregate = await tx.projectMeasurement.aggregate({
      where: { projectId: project.id },
      _sum: { area: true },
    });

    await tx.project.update({
      where: { id: project.id },
      data: {
        scaffoldArea: aggregate._sum.area ?? new Prisma.Decimal(0),
      },
    });

    return created;
  });

  return MobileMeasurementDTO.build(measurement);
};

/**
 * Deletes a measurement and recalculates the project's total scaffoldArea.
 *
 * @param {TDeleteMeasurementServiceParams} params - Project and measurement.
 * @returns {Promise<{ id: string }>} Deleted measurement id.
 */
export const deleteProjectMeasurementService = async ({
  project,
  measurement,
}: TDeleteMeasurementServiceParams): Promise<{ id: string }> => {
  await prisma.$transaction(async (tx) => {
    await tx.projectMeasurement.delete({ where: { id: measurement.id } });

    const aggregate = await tx.projectMeasurement.aggregate({
      where: { projectId: project.id },
      _sum: { area: true },
    });

    await tx.project.update({
      where: { id: project.id },
      data: {
        scaffoldArea: aggregate._sum.area ?? null,
      },
    });
  });

  return { id: measurement.id };
};

/**
 * Lists project notes newest-first with author projection.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileProjectNoteDTO[]>} Note rows.
 */
export const listProjectNotesService = async ({
  project,
}: TMobileProjectServiceParams): Promise<MobileProjectNoteDTO[]> => {
  const notes = await prisma.projectNote.findMany({
    where: { projectId: project.id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return notes.map((note) => MobileProjectNoteDTO.build(note));
};

/**
 * Creates a categorized project note authored by the authenticated user.
 *
 * @param {TCreateProjectNoteServiceParams} params - Author, project, and payload.
 * @returns {Promise<MobileProjectNoteDTO>} Created note DTO.
 */
export const createProjectNoteService = async ({
  user,
  project,
  payload,
}: TCreateProjectNoteServiceParams): Promise<MobileProjectNoteDTO> => {
  const note = await prisma.projectNote.create({
    data: {
      projectId: project.id,
      authorId: user.id,
      category: payload.category,
      content: payload.content,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return MobileProjectNoteDTO.build(note);
};

/**
 * Deletes a project note.
 *
 * @param {TDeleteProjectNoteServiceParams} params - Trusted note.
 * @returns {Promise<{ id: string }>} Deleted note id.
 */
export const deleteProjectNoteService = async ({
  note,
}: TDeleteProjectNoteServiceParams): Promise<{ id: string }> => {
  await prisma.projectNote.delete({ where: { id: note.id } });
  return { id: note.id };
};

/**
 * Updates project contact fields and optionally the most recently updated phase's
 * type/status/priority (project settings screen).
 *
 * @param {TUpdateMobileProjectServiceParams} params - Project and patch payload.
 * @returns {Promise<MobileProjectSettingsDTO>} Updated settings projection.
 */
export const updateMobileProjectService = async ({
  project,
  payload,
}: TUpdateMobileProjectServiceParams): Promise<MobileProjectSettingsDTO> => {
  const {
    phaseType,
    status,
    priority,
    contactName,
    contactPhone,
    contactEmail,
  } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        ...(contactName !== undefined ? { contactName } : {}),
        ...(contactPhone !== undefined ? { contactPhone } : {}),
        ...(contactEmail !== undefined ? { contactEmail } : {}),
      },
    });

    if (
      phaseType !== undefined ||
      status !== undefined ||
      priority !== undefined
    ) {
      const primaryPhase = await tx.projectPhase.findFirst({
        where: { projectId: project.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (primaryPhase) {
        await tx.projectPhase.update({
          where: { id: primaryPhase.id },
          data: {
            ...(phaseType !== undefined ? { type: phaseType } : {}),
            ...(status !== undefined ? { status } : {}),
            ...(priority !== undefined ? { priority } : {}),
          },
        });
      }
    }
  });

  const refreshed = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { phases: { orderBy: { createdAt: 'desc' } } },
  });

  return MobileProjectSettingsDTO.build(refreshed);
};

/**
 * Updates phase schedule fields and optional safety-inspection completion flag.
 *
 * @param {TUpdatePhaseDatesServiceParams} params - Phase and dates payload.
 * @returns {Promise<MobilePhaseDatesDTO>} Updated phase dates DTO.
 */
export const updatePhaseDatesService = async ({
  phase,
  payload,
}: TUpdatePhaseDatesServiceParams): Promise<MobilePhaseDatesDTO> => {
  const updated = await prisma.projectPhase.update({
    where: { id: phase.id },
    data: {
      ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
      ...(payload.endDate !== undefined ? { endDate: payload.endDate } : {}),
      ...(payload.durationDays !== undefined
        ? {
            durationDays:
              payload.durationDays === null
                ? null
                : new Prisma.Decimal(payload.durationDays),
          }
        : {}),
      ...(payload.safetyInspectionComplete !== undefined
        ? { safetyInspectionComplete: payload.safetyInspectionComplete }
        : {}),
    },
  });

  return MobilePhaseDatesDTO.build(updated);
};

/**
 * Registers a project attachment row for a previously uploaded S3 object.
 *
 * @param {TCreateProjectAttachmentServiceParams} params - Project and payload.
 * @returns {Promise<MobileAttachmentDTO>} Created attachment DTO.
 */
export const createProjectAttachmentService = async ({
  project,
  payload,
}: TCreateProjectAttachmentServiceParams): Promise<MobileAttachmentDTO> => {
  const attachment = await prisma.attachment.create({
    data: {
      projectId: project.id,
      url: payload.url,
      fileType: payload.fileType,
      category: payload.category,
    },
  });
  return MobileAttachmentDTO.build(attachment);
};

/**
 * Deletes a project attachment row (does not remove the S3 object).
 *
 * @param {TDeleteProjectAttachmentServiceParams} params - Trusted attachment.
 * @returns {Promise<{ id: string }>} Deleted attachment id.
 */
export const deleteProjectAttachmentService = async ({
  attachment,
}: TDeleteProjectAttachmentServiceParams): Promise<{ id: string }> => {
  await prisma.attachment.delete({ where: { id: attachment.id } });
  return { id: attachment.id };
};
