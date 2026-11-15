import {
  ActivityType,
  AttachmentCategory,
  CustomerCategory,
  InspectionStatus,
  Language,
  MeasurementUnit,
  PhaseStatus,
  PhaseType,
  Priority,
  Prisma,
  ProjectNoteCategory,
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
  MobileEnumsDTO,
  MobileHoursByActivityDTO,
  MobileInspectionDTO,
  MobileLegalContentDTO,
  MobileManagedPhaseDTO,
  MobileMapPinDTO,
  MobileMapProjectDTO,
  MobileMeasurementDTO,
  MobileMeasurementsListDTO,
  MobilePhaseDatesDTO,
  MobilePhaseTypeStatsDTO,
  MobileProjectDetailDTO,
  MobileProjectHistoryDTO,
  MobileProjectNoteDTO,
  MobileProjectPhaseCardDTO,
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
  getPeriodRange,
  getUtcDayEndExclusive,
  getUtcDayStart,
  getUtcWeekEndExclusive,
  getUtcWeekStart,
  haversineKm,
  toCoordinates,
} from '@/app/modules/mobile/mobile.helpers';
import {
  mapPhaseTypeToScheduleActivity,
  mapScheduleActivityToPhaseType,
} from '@/app/modules/mobile/mobile.schema';
import {
  TCompleteInspectionServiceParams,
  TCreateMeasurementServiceParams,
  TCreateMobileProjectServiceParams,
  TCreateProjectAttachmentServiceParams,
  TCreateProjectNoteServiceParams,
  TCreateProjectTaskServiceParams,
  TDeleteMeasurementServiceParams,
  TDeleteProjectAttachmentServiceParams,
  TDeleteProjectNoteServiceParams,
  TGetCrewTimeServiceParams,
  TGetDashboardServiceParams,
  TGetMapServiceParams,
  TGetMobileInspectionServiceParams,
  TGetMyProjectsServiceParams,
  TGetMyTimeLogsServiceParams,
  TGetScheduleServiceParams,
  TListMobileInspectionsServiceParams,
  TListMobilePhasesServiceParams,
  TListProjectAttachmentsServiceParams,
  TListProjectChildServiceParams,
  TListProjectTasksServiceParams,
  TManualTimeServiceParams,
  TMobileProjectServiceParams,
  TMobileUserServiceParams,
  TProjectTaskServiceParams,
  TStartTimerServiceParams,
  TStopTimerServiceParams,
  TSyncTimeLogsServiceParams,
  TSetProjectAttachmentCoverServiceParams,
  TUpdateMeasurementServiceParams,
  TUpdateMobilePhaseStatusServiceParams,
  TUpdateMobileProjectServiceParams,
  TUpdatePhaseDatesServiceParams,
  TUpdateProjectNoteServiceParams,
} from '@/app/modules/mobile/mobile.types';
import { paginateArray } from '@/app/utils/pagination.utils';

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

  const enums = new MobileEnumsDTO(
    Object.values(PhaseStatus),
    Object.values(PhaseType),
    Object.values(Priority),
    Object.values(ActivityType),
    Object.values(CustomerCategory),
    Object.values(InspectionStatus),
    Object.values(TimeLogStatus),
    Object.values(ProjectNoteCategory),
    Object.values(AttachmentCategory),
    Object.values(MeasurementUnit),
    ['erection', 'dismantling', 'standing', 'other'],
    Object.values(Role),
    Object.values(Language)
  );

  return new MobileConfigDTO(
    profile?.defaultLanguage ?? Language.DE,
    profile?.enabledLanguages?.length
      ? profile.enabledLanguages
      : [Language.DE, Language.EN],
    profile?.allowEmployeeManualTime ?? true,
    legalContents,
    enums
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
  query,
}: TGetDashboardServiceParams): Promise<{
  data: MobileDashboardDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const userId = user.id;
  const page = query.page;
  const limit = query.limit;
  const globalAccess = await hasSiteManagerGlobalAccess(user);

  const phaseScope = globalAccess
    ? { project: { deletedAt: null } }
    : {
        project: { deletedAt: null },
        OR: [
          { crewAssignments: { some: { userId } } },
          { project: { projectManagers: { some: { userId } } } },
        ],
      };

  const [
    pendingInspections,
    upcomingPhases,
    activeProjectsCount,
    standingActiveSites,
    erectionPhases,
    dismantlingPhases,
  ] = await Promise.all([
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
        ...phaseScope,
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
    prisma.project.count({
      where: {
        deletedAt: null,
        phases: {
          some: {
            type: PhaseType.STANDING,
            status: { in: ACTIVE_PHASE_STATUSES },
          },
        },
        ...(globalAccess
          ? {}
          : {
              OR: [
                { projectManagers: { some: { userId } } },
                { phases: { some: { crewAssignments: { some: { userId } } } } },
              ],
            }),
      },
    }),
    prisma.projectPhase.findMany({
      where: { type: PhaseType.ERECTION, ...phaseScope },
      select: { status: true },
    }),
    prisma.projectPhase.findMany({
      where: { type: PhaseType.DISMANTLING, ...phaseScope },
      select: { status: true },
    }),
  ]);

  const countPlannedRunning = (
    rows: Array<{ status: PhaseStatus }>
  ): MobilePhaseTypeStatsDTO => {
    let planned = 0;
    let running = 0;
    for (const row of rows) {
      if (row.status === PhaseStatus.IN_PROGRESS) running += 1;
      else if (
        row.status === PhaseStatus.ENQUIRY ||
        row.status === PhaseStatus.QUOTATION ||
        row.status === PhaseStatus.ORDER_CONFIRMED
      ) {
        planned += 1;
      }
    }
    return new MobilePhaseTypeStatsDTO(planned, running);
  };

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
        toCoordinates(
          decimalToNumber(phase.project.latitude),
          decimalToNumber(phase.project.longitude)
        ),
        phase.type as PhaseType
      )
    );
  }

  const allPins = [...pinByProject.values()];
  const tasksPage = paginateArray(upcomingTasks, page, limit);
  const pinsPage = paginateArray(allPins, page, limit);

  return {
    data: new MobileDashboardDTO(
      new MobileDashboardStatsDTO(
        pendingInspections,
        activeProjectsCount,
        standingActiveSites,
        countPlannedRunning(erectionPhases),
        countPlannedRunning(dismantlingPhases)
      ),
      tasksPage.items,
      pinsPage.items
    ),
    total: Math.max(tasksPage.total, pinsPage.total),
    page,
    limit,
  };
};

/**
 * Builds the Prisma `where` clause for a projects-list UI tab.
 *
 * @param {TGetMyProjectsServiceParams['query']['tab']} tab - Selected navigation tab.
 * @param {string} userId - Authenticated user UUID (for `MY_PROJECTS`).
 * @returns {Prisma.ProjectWhereInput} Tab-specific where fragment.
 */
const buildProjectTabWhere = (
  tab: TGetMyProjectsServiceParams['query']['tab'],
  userId: string
): Prisma.ProjectWhereInput => {
  switch (tab) {
    case 'ACTIVE':
      return {
        deletedAt: null,
        phases: {
          some: {
            status: {
              in: [PhaseStatus.IN_PROGRESS, PhaseStatus.ORDER_CONFIRMED],
            },
          },
        },
      };
    case 'MY_PROJECTS':
      return {
        deletedAt: null,
        OR: [
          { projectManagers: { some: { userId } } },
          { phases: { some: { crewAssignments: { some: { userId } } } } },
        ],
      };
    case 'THIS_WEEK': {
      const startOfWeek = getUtcWeekStart();
      const endOfWeek = getUtcWeekEndExclusive(startOfWeek);
      return {
        deletedAt: null,
        phases: {
          some: {
            OR: [
              { startDate: { gte: startOfWeek, lt: endOfWeek } },
              { endDate: { gte: startOfWeek, lt: endOfWeek } },
            ],
          },
        },
      };
    }
    case 'INSPECTION':
      return {
        deletedAt: null,
        customer: {
          inspections: {
            some: {
              status: InspectionStatus.PENDING,
              deletedAt: null,
            },
          },
        },
      };
    case 'ALL':
    default:
      return { deletedAt: null };
  }
};

/**
 * Builds Prisma `where` filters for the filter-modal query params.
 * Phase type/status/priority filters require at least one matching phase so the
 * project is eligible; row-level phase filtering happens when flattening cards.
 *
 * @param {TGetMyProjectsServiceParams['query']} query - Validated list filters.
 * @returns {Prisma.ProjectWhereInput} Additional where clauses (AND-merged by caller).
 */
const buildProjectModalFilters = (
  query: TGetMyProjectsServiceParams['query']
): Prisma.ProjectWhereInput => {
  const and: Prisma.ProjectWhereInput[] = [];
  const phaseSome: Prisma.ProjectPhaseWhereInput = {};

  if (query.phaseTypes && query.phaseTypes.length > 0) {
    phaseSome.type = { in: query.phaseTypes };
  }
  if (query.phaseStatuses && query.phaseStatuses.length > 0) {
    phaseSome.status = { in: query.phaseStatuses };
  }
  if (query.priorities && query.priorities.length > 0) {
    phaseSome.priority = { in: query.priorities };
  }
  if (Object.keys(phaseSome).length > 0) {
    and.push({ phases: { some: phaseSome } });
  }
  if (query.categories && query.categories.length > 0) {
    and.push({
      customer: {
        category: { in: query.categories },
        deletedAt: null,
      },
    });
  }
  if (query.search) {
    and.push({
      name: { contains: query.search, mode: 'insensitive' },
    });
  }
  if (query.lat !== undefined && query.lng !== undefined) {
    const radiusKm = query.radiusKm ?? 25;
    const latDelta = radiusKm / 111;
    const lngDelta =
      radiusKm / (111 * Math.max(0.2, Math.cos((query.lat * Math.PI) / 180)));
    and.push({
      latitude: {
        gte: new Prisma.Decimal(query.lat - latDelta),
        lte: new Prisma.Decimal(query.lat + latDelta),
      },
      longitude: {
        gte: new Prisma.Decimal(query.lng - lngDelta),
        lte: new Prisma.Decimal(query.lng + lngDelta),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
};

/**
 * Returns whether a phase should become a list card under the modal filters.
 *
 * @param {{ type: PhaseType; status: PhaseStatus; priority: Priority }} phase - Phase fields.
 * @param {TGetMyProjectsServiceParams['query']} query - Validated filters.
 * @returns {boolean} True when the phase matches modal phase filters (or none set).
 */
const phaseMatchesModalFilters = (
  phase: { type: PhaseType; status: PhaseStatus; priority: Priority },
  query: TGetMyProjectsServiceParams['query']
): boolean => {
  if (
    query.phaseTypes &&
    query.phaseTypes.length > 0 &&
    !query.phaseTypes.includes(phase.type)
  ) {
    return false;
  }
  if (
    query.phaseStatuses &&
    query.phaseStatuses.length > 0 &&
    !query.phaseStatuses.includes(phase.status)
  ) {
    return false;
  }
  if (
    query.priorities &&
    query.priorities.length > 0 &&
    !query.priorities.includes(phase.priority)
  ) {
    return false;
  }
  return true;
};

/**
 * Earliest pending customer inspection appointment used for `NEXT_INSPECTION` sort.
 *
 * @param {{ appointmentDate: Date }[]} inspections - Pending inspections on the customer.
 * @returns {number} Epoch ms or `Number.POSITIVE_INFINITY` when none exist.
 */
const nextInspectionSortKey = (
  inspections: Array<{ appointmentDate: Date }>
): number => {
  if (inspections.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...inspections.map((row) => row.appointmentDate.getTime()));
};

/**
 * Lists projects as phase-centric cards for the mobile Projects tab.
 * SITE_MANAGER + `GLOBAL_ACCESS` starts from all non-deleted projects; otherwise
 * scopes to assignment (PM or crew). Tab + modal filters are AND-merged; each
 * matching phase becomes one card so Flutter can render one card per phase.
 *
 * @param {TGetMyProjectsServiceParams} params - Authenticated user and filters.
 * @returns {Promise<MobileProjectPhaseCardDTO[]>} Phase card rows.
 */
export const getMyProjectsService = async ({
  user,
  query,
}: TGetMyProjectsServiceParams): Promise<{
  items: MobileProjectPhaseCardDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const userId = user.id;
  const page = query.page;
  const limit = query.limit;
  const globalAccess = await hasSiteManagerGlobalAccess(user);
  const tabWhere = buildProjectTabWhere(query.tab ?? 'ALL', userId);
  const modalWhere = buildProjectModalFilters(query);
  const sortBy = query.sortBy ?? 'NEWEST';

  type TProjectListRow = {
    id: string;
    name: string;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    budgetedHours: Prisma.Decimal | number;
    createdAt: Date;
    customer: {
      id: string;
      name: string;
      category: import('@prisma/client').CustomerCategory;
      inspections: Array<{ appointmentDate: Date }>;
    };
    projectManagers: Array<{
      user: { firstName: string; lastName: string };
    }>;
    phases: Array<{
      id: string;
      type: PhaseType;
      status: PhaseStatus;
      priority: Priority;
      startDate: Date | null;
      endDate: Date | null;
      durationDays: Prisma.Decimal | null;
    }>;
  };

  const include = {
    customer: {
      select: {
        id: true,
        name: true,
        category: true,
        inspections: {
          where: {
            status: InspectionStatus.PENDING,
            deletedAt: null,
          },
          select: { appointmentDate: true },
          orderBy: { appointmentDate: 'asc' as const },
        },
      },
    },
    projectManagers: {
      take: 1,
      orderBy: { assignedAt: 'asc' as const },
      select: {
        user: { select: { firstName: true, lastName: true } },
      },
    },
    phases: {
      orderBy: { createdAt: 'desc' as const },
    },
  };

  let scopedProjects: TProjectListRow[] = [];

  if (globalAccess) {
    scopedProjects = await prisma.project.findMany({
      where: {
        AND: [tabWhere, modalWhere],
      },
      include,
    });
  } else {
    const assignedProjectIds = await getAssignedProjectIds(userId);
    if (assignedProjectIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }

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
        AND: [
          { id: { in: assignedProjectIds } },
          tabWhere,
          modalWhere,
        ],
      },
      include,
    });

    scopedProjects = projects.map((project) => ({
      ...project,
      phases: managedProjectIds.has(project.id)
        ? project.phases
        : project.phases.filter((phase) => crewPhaseIds.has(phase.id)),
    }));
  }

  if (query.lat !== undefined && query.lng !== undefined) {
    const radiusKm = query.radiusKm ?? 25;
    scopedProjects = scopedProjects.filter((project) => {
      const lat = decimalToNumber(project.latitude);
      const lng = decimalToNumber(project.longitude);
      if (lat === null || lng === null) return false;
      return haversineKm(query.lat!, query.lng!, lat, lng) <= radiusKm;
    });
  }

  const loggedByProject = await getLoggedHoursByProjectId(
    scopedProjects.map((project) => project.id)
  );

  let cards: MobileProjectPhaseCardDTO[] = [];

  for (const project of scopedProjects) {
    const pm = project.projectManagers[0]?.user;
    const assigneeName = pm ? `${pm.firstName} ${pm.lastName}` : null;
    const logged = loggedByProject.get(project.id) ?? 0;
    const budgeted = Number(project.budgetedHours);
    const coordinates = toCoordinates(
      decimalToNumber(project.latitude),
      decimalToNumber(project.longitude)
    );

    for (const phase of project.phases) {
      if (!phaseMatchesModalFilters(phase, query)) continue;

      const card = new MobileProjectPhaseCardDTO(
        phase.id,
        phase.type,
        phase.status,
        phase.priority,
        phase.startDate ? phase.startDate.toISOString() : null,
        phase.endDate ? phase.endDate.toISOString() : null,
        decimalToNumber(phase.durationDays),
        project.id,
        project.name,
        coordinates,
        {
          id: project.customer.id,
          name: project.customer.name,
          category: project.customer.category,
        },
        assigneeName
      );

      if (user.role === Role.SITE_MANAGER) {
        card.budgetedHours = budgeted;
        card.totalLoggedHours = Number(logged.toFixed(2));
        card.isProfitable = card.totalLoggedHours <= budgeted;
      }

      cards.push(card);
    }
  }

  if (sortBy === 'NAME_AZ') {
    cards.sort((a, b) => a.projectName.localeCompare(b.projectName));
  } else if (sortBy === 'NEXT_INSPECTION') {
    const nextByProject = new Map(
      scopedProjects.map((project) => [
        project.id,
        nextInspectionSortKey(project.customer.inspections),
      ])
    );
    cards.sort(
      (a, b) =>
        (nextByProject.get(a.projectId) ?? Number.POSITIVE_INFINITY) -
        (nextByProject.get(b.projectId) ?? Number.POSITIVE_INFINITY)
    );
  } else {
    const createdByProject = new Map(
      scopedProjects.map((project) => [project.id, project.createdAt.getTime()])
    );
    cards.sort(
      (a, b) =>
        (createdByProject.get(b.projectId) ?? 0) -
        (createdByProject.get(a.projectId) ?? 0)
    );
  }

  return paginateArray(cards, page, limit);
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
}: TGetMyTimeLogsServiceParams): Promise<{
  items: MobileTimeLogDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { start, endExclusive } = getPeriodRange(query.period);
  const { page, limit } = query;
  const where = {
    userId: user.id,
    startTime: {
      gte: start,
      lt: endExclusive,
    },
  };

  const [total, timeLogs] = await Promise.all([
    prisma.timeLog.count({ where }),
    prisma.timeLog.findMany({
      where,
      include: timeLogInclude,
      orderBy: { startTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: timeLogs.map(MobileTimeLogDTO.build),
    total,
    page,
    limit,
  };
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
}: TGetCrewTimeServiceParams): Promise<{
  data: MobileCrewTimeDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
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

  const logsPage = paginateArray(
    timeLogs.map(MobileTimeLogDTO.build),
    page,
    limit
  );

  return {
    data: new MobileCrewTimeDTO(
      totalLoggedHours,
      hoursByActivity.map(
        (row) => new MobileHoursByActivityDTO(row.activityType, row.hours)
      ),
      crewBreakdown,
      logsPage.items
    ),
    total: logsPage.total,
    page,
    limit,
  };
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
}: TGetScheduleServiceParams): Promise<{
  items: MobileScheduleDayDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
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

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayPhases]) => new MobileScheduleDayDTO(date, dayPhases));

  return paginateArray(days, page, limit);
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
}: TGetMapServiceParams): Promise<{
  items: MobileMapProjectDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
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
        toCoordinates(
          decimalToNumber(phase.project.latitude),
          decimalToNumber(phase.project.longitude)
        ),
        phase.type
      )
    );
  }

  return paginateArray([...pinByProject.values()], page, limit);
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
 * Lists inspections assigned to the authenticated site manager.
 * `status=PENDING` → PENDING only; `status=COMPLETED` → SURVEY_DONE + CONVERTED.
 *
 * @param {TListMobileInspectionsServiceParams} params - Site manager and status tab.
 * @returns {Promise<MobileInspectionDTO[]>} Assigned inspections for the survey list.
 */
export const listMobileInspectionsService = async ({
  user,
  query,
}: TListMobileInspectionsServiceParams): Promise<{
  items: MobileInspectionDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const statusFilter =
    query.status === 'COMPLETED'
      ? {
          status: {
            in: [InspectionStatus.SURVEY_DONE, InspectionStatus.CONVERTED],
          },
        }
      : { status: InspectionStatus.PENDING };

  const where = {
    siteManagerId: user.id,
    deletedAt: null,
    ...statusFilter,
  };

  const [total, inspections] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, category: true } },
      },
      orderBy: { appointmentDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: inspections.map((inspection) =>
      MobileInspectionDTO.build(inspection)
    ),
    total,
    page,
    limit,
  };
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
      customer: { select: { id: true, name: true, category: true } },
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
          customer: { select: { id: true, name: true, category: true } },
        },
      });
      return { inspection: updated, project: null as { id: string; name: string } | null };
    }

    const project = await tx.project.create({
      data: {
        customerId: inspection.customerId,
        name: projectName,
        address: inspection.address,
        city: inspection.city,
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
        projectId: project.id,
      },
      include: {
        customer: { select: { id: true, name: true, category: true } },
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
  query,
}: TListMobilePhasesServiceParams): Promise<{
  items: MobileManagedPhaseDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const columnWhere =
    query.column === 'ENQUIRY'
      ? { status: PhaseStatus.ENQUIRY }
      : query.column === 'ERECTION' ||
          query.column === 'DISMANTLING' ||
          query.column === 'STANDING'
        ? { type: query.column as PhaseType }
        : {};

  const where = {
    ...columnWhere,
    project: {
      deletedAt: null,
      projectManagers: {
        some: { userId: user.id },
      },
    },
  };

  const [total, phases] = await Promise.all([
    prisma.projectPhase.count({ where }),
    prisma.projectPhase.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, address: true },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: phases.map(
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
    ),
    total,
    page,
    limit,
  };
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
 * Lists open and completed tasks for a project, including assignee details.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileProjectTasksListDTO>} Open and completed task lists.
 */
export const listProjectTasksService = async ({
  project,
  query,
}: TListProjectTasksServiceParams): Promise<{
  data: MobileProjectTasksListDTO | MobileProjectTaskDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, status } = query;
  const tasks = await prisma.projectTask.findMany({
    where: {
      projectId: project.id,
      ...(status === 'OPEN'
        ? { isCompleted: false }
        : status === 'COMPLETED'
          ? { isCompleted: true }
          : {}),
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  if (status === 'OPEN' || status === 'COMPLETED') {
    const sliced = paginateArray(
      tasks.map((task) => MobileProjectTaskDTO.build(task)),
      page,
      limit
    );
    return {
      data: sliced.items,
      total: sliced.total,
      page: sliced.page,
      limit: sliced.limit,
    };
  }

  const open = tasks
    .filter((task) => !task.isCompleted)
    .map((task) => MobileProjectTaskDTO.build(task));
  const completed = tasks
    .filter((task) => task.isCompleted)
    .map((task) => MobileProjectTaskDTO.build(task));
  const openPage = paginateArray(open, page, limit);
  const completedPage = paginateArray(completed, page, limit);

  return {
    data: new MobileProjectTasksListDTO(openPage.items, completedPage.items),
    total: openPage.total + completedPage.total,
    page,
    limit,
  };
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
 * Lists measurement line items for a project with total calculated area.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileMeasurementsListDTO>} Items plus total area.
 */
export const listProjectMeasurementsService = async ({
  project,
  query,
}: TListProjectChildServiceParams): Promise<{
  data: MobileMeasurementsListDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const where = { projectId: project.id };

  const [total, rows, aggregate] = await Promise.all([
    prisma.projectMeasurement.count({ where }),
    prisma.projectMeasurement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.projectMeasurement.aggregate({
      where,
      _sum: { area: true },
    }),
  ]);

  const totalArea = Number(
    (aggregate._sum.area ? Number(aggregate._sum.area) : 0).toFixed(2)
  );

  return {
    data: new MobileMeasurementsListDTO(
      rows.map((row) => MobileMeasurementDTO.build(row)),
      totalArea
    ),
    total,
    page,
    limit,
  };
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
  query,
}: TListProjectChildServiceParams): Promise<{
  items: MobileProjectNoteDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const where = { projectId: project.id };

  const [total, notes] = await Promise.all([
    prisma.projectNote.count({ where }),
    prisma.projectNote.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: notes.map((note) => MobileProjectNoteDTO.build(note)),
    total,
    page,
    limit,
  };
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
 * Elaborates project edit for all project fields except customer linkage.
 * Optionally updates the most recently updated phase (type/status/priority/dates).
 *
 * @param {TUpdateMobileProjectServiceParams} params - Project and patch payload.
 * @returns {Promise<MobileProjectSettingsDTO>} Updated settings projection.
 */
export const updateMobileProjectService = async ({
  project,
  payload,
}: TUpdateMobileProjectServiceParams): Promise<MobileProjectSettingsDTO> => {
  const {
    name,
    coordinates,
    budgetedHours,
    scaffoldArea,
    siteAccessCode,
    siteAccessNotes,
    phaseType,
    status,
    priority,
    startDate,
    endDate,
    durationDays,
    safetyInspectionComplete,
  } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(coordinates !== undefined
          ? coordinates === null
            ? { latitude: null, longitude: null }
            : {
                latitude: new Prisma.Decimal(coordinates.lat),
                longitude: new Prisma.Decimal(coordinates.lng),
              }
          : {}),
        ...(budgetedHours !== undefined
          ? { budgetedHours: new Prisma.Decimal(budgetedHours) }
          : {}),
        ...(scaffoldArea !== undefined
          ? {
              scaffoldArea:
                scaffoldArea === null ? null : new Prisma.Decimal(scaffoldArea),
            }
          : {}),
        ...(siteAccessCode !== undefined ? { siteAccessCode } : {}),
        ...(siteAccessNotes !== undefined ? { siteAccessNotes } : {}),
      },
    });

    const touchesPhase =
      phaseType !== undefined ||
      status !== undefined ||
      priority !== undefined ||
      startDate !== undefined ||
      endDate !== undefined ||
      durationDays !== undefined ||
      safetyInspectionComplete !== undefined;

    if (touchesPhase) {
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
            ...(startDate !== undefined ? { startDate } : {}),
            ...(endDate !== undefined ? { endDate } : {}),
            ...(durationDays !== undefined
              ? {
                  durationDays:
                    durationDays === null
                      ? null
                      : new Prisma.Decimal(durationDays),
                }
              : {}),
            ...(safetyInspectionComplete !== undefined
              ? { safetyInspectionComplete }
              : {}),
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
  const makeCover =
    payload.isCover === true && payload.category === AttachmentCategory.PHOTO;

  const attachment = await prisma.$transaction(async (tx) => {
    if (makeCover) {
      await tx.attachment.updateMany({
        where: {
          projectId: project.id,
          category: AttachmentCategory.PHOTO,
          isCover: true,
        },
        data: { isCover: false },
      });
    }

    return tx.attachment.create({
      data: {
        projectId: project.id,
        url: payload.url,
        fileType: payload.fileType,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        isCover: makeCover,
        category: payload.category,
      },
    });
  });

  return MobileAttachmentDTO.build(attachment);
};

/**
 * Sets a project PHOTO attachment as the cover image (clears other covers).
 *
 * @param {TSetProjectAttachmentCoverServiceParams} params - Project and attachment.
 * @returns {Promise<MobileAttachmentDTO>} Updated cover attachment.
 */
export const setProjectAttachmentCoverService = async ({
  project,
  attachment,
}: TSetProjectAttachmentCoverServiceParams): Promise<MobileAttachmentDTO> => {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.attachment.updateMany({
      where: {
        projectId: project.id,
        category: AttachmentCategory.PHOTO,
        isCover: true,
      },
      data: { isCover: false },
    });

    return tx.attachment.update({
      where: { id: attachment.id },
      data: { isCover: true },
    });
  });

  return MobileAttachmentDTO.build(updated);
};

/**
 * Returns project detail hub data for Overview and header badges.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileProjectDetailDTO>} Detail payload.
 */

/**
 * Creates a project for a Site Manager from the Create New Project form.
 * Location is taken from map `coordinates` (required). Optional `placeLabel`
 * fills the DB `address` column; otherwise `"lat, lng"` is stored.
 * Supports EXISTING or NEW customer, primary contact, erection/dismantling
 * schedules, optional note, and optional photos.
 *
 * @param {TCreateMobileProjectServiceParams} params - Creator, assignee SM, optional customer, payload.
 * @returns {Promise<MobileProjectDetailDTO>} Created project detail hub.
 */
export const createMobileProjectService = async ({
  user,
  siteManager,
  payload,
}: TCreateMobileProjectServiceParams): Promise<MobileProjectDetailDTO> => {
  const address =
    payload.placeLabel?.trim() ||
    `${payload.coordinates.lat}, ${payload.coordinates.lng}`;
  const priority = payload.priority ?? Priority.MEDIUM;
  const phaseType = payload.phaseType ?? PhaseType.ERECTION;
  const status = payload.status ?? PhaseStatus.ENQUIRY;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const endFromDuration = (start: Date, durationDays: number): Date => {
    return new Date(start.getTime() + durationDays * MS_PER_DAY);
  };

  const durationFromRange = (start: Date, end: Date): number => {
    return Math.max(0, (end.getTime() - start.getTime()) / MS_PER_DAY);
  };

  /**
   * Resolves start/end/duration for one scheduleData row (create ↔ detail same fields).
   *
   * @param {{ startDate: Date; endDate?: Date; durationDays?: number }} schedule - Flutter schedule entry.
   * @returns {{ startDate: Date; endDate: Date; durationDays: number }} Normalized dates for ProjectPhase.
   */
  const resolveScheduleDates = (schedule: {
    startDate: Date;
    endDate?: Date;
    durationDays?: number;
  }): { startDate: Date; endDate: Date; durationDays: number } => {
    const startDate = schedule.startDate;
    if (schedule.endDate !== undefined) {
      const endDate = schedule.endDate;
      const durationDays =
        schedule.durationDays !== undefined
          ? schedule.durationDays
          : Number(durationFromRange(startDate, endDate).toFixed(2));
      return { startDate, endDate, durationDays };
    }
    const durationDays = schedule.durationDays ?? 0;
    return {
      startDate,
      endDate: endFromDuration(startDate, durationDays),
      durationDays,
    };
  };

  const projectId = await prisma.$transaction(async (tx) => {
    let customerId: string;

    if (payload.customer.mode === 'EXISTING') {
      customerId = payload.customer.customerId;
      await tx.customerContact.updateMany({
        where: { customerId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.customerContact.create({
        data: {
          customerId,
          name: payload.contact.name,
          role: payload.contact.role ?? 'Project lead',
          phone: payload.contact.phone,
          email: payload.contact.email,
          isPrimary: true,
        },
      });
    } else {
      const createdCustomer = await tx.customer.create({
        data: {
          name: payload.customer.name,
          category: payload.customer.category ?? CustomerCategory.COMMERCIAL,
          address,
          latitude: new Prisma.Decimal(payload.coordinates.lat),
          longitude: new Prisma.Decimal(payload.coordinates.lng),
          contacts: {
            create: {
              name: payload.contact.name,
              role: payload.contact.role ?? 'Project lead',
              phone: payload.contact.phone,
              email: payload.contact.email,
              isPrimary: true,
            },
          },
        },
      });
      customerId = createdCustomer.id;
    }

    const scaffoldAreaValue =
      payload.scaffoldSpecification?.area ?? payload.scaffoldArea;
    const scaffoldHeight = payload.scaffoldSpecification?.height;
    const scaffoldType = payload.scaffoldSpecification?.type;

    const project = await tx.project.create({
      data: {
        customerId,
        name: payload.name,
        address,
        latitude: new Prisma.Decimal(payload.coordinates.lat),
        longitude: new Prisma.Decimal(payload.coordinates.lng),
        scaffoldArea:
          scaffoldAreaValue !== undefined
            ? new Prisma.Decimal(scaffoldAreaValue)
            : undefined,
      },
    });

    // Seed measurement so detail scaffoldSpecification.height/type resolve.
    if (
      scaffoldAreaValue !== undefined ||
      scaffoldHeight !== undefined ||
      scaffoldType !== undefined
    ) {
      const height = scaffoldHeight ?? 1;
      const area = scaffoldAreaValue ?? height;
      await tx.projectMeasurement.create({
        data: {
          projectId: project.id,
          length: new Prisma.Decimal(0),
          height: new Prisma.Decimal(height),
          quantity: new Prisma.Decimal(1),
          area: new Prisma.Decimal(area),
          scaffoldType: scaffoldType,
          remark: 'Initial scaffold specification',
        },
      });
    }

    await tx.projectManagerAssignment.create({
      data: {
        projectId: project.id,
        userId: siteManager.id,
      },
    });

    const typedSchedules: Array<{
      type: PhaseType;
      startDate: Date;
      endDate?: Date;
      durationDays?: number;
    }> = [
      ...(payload.scheduleData ?? []).map((schedule) => ({
        type: mapScheduleActivityToPhaseType(schedule.type),
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        durationDays: schedule.durationDays,
      })),
      ...(payload.schedules ?? []).map((schedule) => ({
        type: mapScheduleActivityToPhaseType(schedule.type),
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        durationDays: schedule.durationDays,
      })),
      ...(payload.erection ?? []).map((schedule) => ({
        type: PhaseType.ERECTION,
        startDate: schedule.startDate,
        durationDays: schedule.durationDays,
      })),
      ...(payload.dismantling ?? []).map((schedule) => ({
        type: PhaseType.DISMANTLING,
        startDate: schedule.startDate,
        durationDays: schedule.durationDays,
      })),
    ];

    if (typedSchedules.length === 0) {
      await tx.projectPhase.create({
        data: {
          projectId: project.id,
          type: phaseType,
          status,
          priority,
        },
      });
    } else {
      for (const [index, schedule] of typedSchedules.entries()) {
        const dates = resolveScheduleDates(schedule);
        await tx.projectPhase.create({
          data: {
            projectId: project.id,
            type: schedule.type,
            status:
              index === 0 && schedule.type === phaseType
                ? status
                : PhaseStatus.ENQUIRY,
            priority,
            startDate: dates.startDate,
            endDate: dates.endDate,
            durationDays: new Prisma.Decimal(dates.durationDays),
          },
        });
      }
    }

    if (payload.note) {
      await tx.projectNote.create({
        data: {
          projectId: project.id,
          authorId: user.id,
          category: payload.note.category,
          content: payload.note.content,
        },
      });
      if (payload.note.category === ProjectNoteCategory.SITE_ACCESS) {
        await tx.project.update({
          where: { id: project.id },
          data: { siteAccessNotes: payload.note.content },
        });
      }
    }

    if (payload.photos && payload.photos.length > 0) {
      const coverIndex = payload.photos.findIndex((p) => p.isCover === true);
      await tx.attachment.createMany({
        data: payload.photos.map((photo, index) => ({
          projectId: project.id,
          url: photo.url,
          fileType: photo.fileType,
          fileName: photo.fileName,
          fileSize: photo.fileSize,
          category: AttachmentCategory.PHOTO,
          isCover: coverIndex >= 0 ? index === coverIndex : index === 0,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        projectId: project.id,
        action: 'MOBILE_PROJECT_CREATED',
        details: JSON.stringify({
          name: project.name,
          customerId,
          siteManagerId: siteManager.id,
        }),
      },
    });

    return project.id;
  });

  const created = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  return getMobileProjectByIdService({ user, project: created });
};

export const getMobileProjectByIdService = async ({
  project,
}: TMobileProjectServiceParams): Promise<MobileProjectDetailDTO> => {
  const [record, timeLogs, photoCount, pdfCount, measurements, nextInspection] =
    await Promise.all([
      prisma.project.findUniqueOrThrow({
        where: { id: project.id },
        include: {
          phases: { orderBy: { updatedAt: 'desc' } },
          customer: {
            include: {
              contacts: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.timeLog.findMany({
        where: { phase: { projectId: project.id } },
        include: timeLogWithUserInclude,
      }),
      prisma.attachment.count({
        where: { projectId: project.id, category: AttachmentCategory.PHOTO },
      }),
      prisma.attachment.count({
        where: { projectId: project.id, category: AttachmentCategory.PDF_PLAN },
      }),
      prisma.projectMeasurement.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.inspection.findFirst({
        where: {
          customerId: project.customerId,
          status: InspectionStatus.PENDING,
          deletedAt: null,
        },
        orderBy: { appointmentDate: 'asc' },
        select: {
          id: true,
          appointmentDate: true,
          siteTitle: true,
          address: true,
          city: true,
        },
      }),
    ]);

  const { totalLoggedHours, hoursByActivity } = aggregateLoggedHours(
    timeLogs as TTimeLogWithBreaks[]
  );
  const budgetedHours = Number(record.budgetedHours);

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

  const primary = record.customer.contacts[0] ?? null;
  const scaffoldType =
    measurements.find((row) => row.scaffoldType)?.scaffoldType ?? null;
  const scaffoldHeight = measurements.reduce<number | null>((max, row) => {
    const height = Number(row.height);
    if (max === null || height > max) return height;
    return max;
  }, null);

  return new MobileProjectDetailDTO(
    record.id,
    record.name,
    toCoordinates(
      decimalToNumber(record.latitude),
      decimalToNumber(record.longitude)
    ),
    record.siteAccessCode,
    record.siteAccessNotes,
    {
      area: decimalToNumber(record.scaffoldArea),
      height: scaffoldHeight,
      type: scaffoldType,
    },
    record.phases.map((phase) => ({
      id: phase.id,
      type: mapPhaseTypeToScheduleActivity(phase.type),
      startDate: phase.startDate ? phase.startDate.toISOString() : null,
      endDate: phase.endDate ? phase.endDate.toISOString() : null,
      durationDays: decimalToNumber(phase.durationDays),
    })),
    nextInspection
      ? {
          id: nextInspection.id,
          appointmentDate: nextInspection.appointmentDate.toISOString(),
          siteTitle: nextInspection.siteTitle,
          address: nextInspection.address,
          city: nextInspection.city,
        }
      : null,
    budgetedHours,
    Number(totalLoggedHours.toFixed(2)),
    totalLoggedHours <= budgetedHours,
    record.phases.map((phase) => MobilePhaseDatesDTO.build(phase)),
    {
      id: record.customer.id,
      name: record.customer.name,
      category: record.customer.category,
      primaryContact: primary
        ? {
            name: primary.name,
            phone: primary.phone,
            email: primary.email,
          }
        : null,
    },
    hoursByActivity.map(
      (row) => new MobileHoursByActivityDTO(row.activityType, row.hours)
    ),
    [...byUser.values()].map(
      (row) =>
        new MobileCrewBreakdownDTO(
          row.user,
          Number(row.hours.toFixed(2)),
          row.logs.length > 0 && row.logs.every((log) => !!log.clientSyncId)
        )
    ),
    { photos: photoCount, pdfPlans: pdfCount }
  );
};

/**
 * Lists project attachments, optionally filtered by PHOTO / PDF_PLAN.
 *
 * @param {TListProjectAttachmentsServiceParams} params - Project and optional category.
 * @returns {Promise<MobileAttachmentDTO[]>} Attachment rows.
 */
export const listProjectAttachmentsService = async ({
  project,
  query,
}: TListProjectAttachmentsServiceParams): Promise<{
  items: MobileAttachmentDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const where = {
    projectId: project.id,
    ...(query.category ? { category: query.category } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.attachment.count({ where }),
    prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((row) => MobileAttachmentDTO.build(row)),
    total,
    page,
    limit,
  };
};

/**
 * Lists project audit history newest-first.
 *
 * @param {TMobileProjectServiceParams} params - Trusted accessible project.
 * @returns {Promise<MobileProjectHistoryDTO[]>} History timeline rows.
 */
export const listProjectHistoryService = async ({
  project,
  query,
}: TListProjectChildServiceParams): Promise<{
  items: MobileProjectHistoryDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const where = { projectId: project.id };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(
      (row) =>
        new MobileProjectHistoryDTO(
          row.id,
          row.action,
          row.details,
          row.createdAt.toISOString(),
          {
            id: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            role: row.user.role,
          }
        )
    ),
    total,
    page,
    limit,
  };
};

/**
 * Updates a project note category and/or content.
 *
 * @param {TUpdateProjectNoteServiceParams} params - Note and patch payload.
 * @returns {Promise<MobileProjectNoteDTO>} Updated note DTO.
 */
export const updateProjectNoteService = async ({
  note,
  payload,
}: TUpdateProjectNoteServiceParams): Promise<MobileProjectNoteDTO> => {
  const updated = await prisma.projectNote.update({
    where: { id: note.id },
    data: {
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.content !== undefined ? { content: payload.content } : {}),
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return MobileProjectNoteDTO.build(updated);
};

/**
 * Updates a measurement line item and recalculates project scaffoldArea.
 *
 * @param {TUpdateMeasurementServiceParams} params - Project, measurement, payload.
 * @returns {Promise<MobileMeasurementDTO>} Updated measurement DTO.
 */
export const updateProjectMeasurementService = async ({
  project,
  measurement,
  payload,
}: TUpdateMeasurementServiceParams): Promise<MobileMeasurementDTO> => {
  const length =
    payload.length !== undefined ? payload.length : Number(measurement.length);
  const height =
    payload.height !== undefined ? payload.height : Number(measurement.height);
  const quantity =
    payload.quantity !== undefined
      ? payload.quantity
      : Number(measurement.quantity);
  const area = length * height * quantity;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.projectMeasurement.update({
      where: { id: measurement.id },
      data: {
        ...(payload.position !== undefined ? { position: payload.position } : {}),
        ...(payload.length !== undefined
          ? { length: new Prisma.Decimal(payload.length) }
          : {}),
        ...(payload.height !== undefined
          ? { height: new Prisma.Decimal(payload.height) }
          : {}),
        ...(payload.quantity !== undefined
          ? { quantity: new Prisma.Decimal(payload.quantity) }
          : {}),
        ...(payload.unit !== undefined ? { unit: payload.unit } : {}),
        ...(payload.remark !== undefined ? { remark: payload.remark } : {}),
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

    return row;
  });

  return MobileMeasurementDTO.build(updated);
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
