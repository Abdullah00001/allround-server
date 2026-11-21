import {
  AttachmentCategory,
  InspectionStatus,
  PhaseStatus,
  PhaseType,
  Prisma,
  Priority,
  TimeLogStatus,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { paginateArray } from '@/app/utils/pagination.utils';
import {
  getUtcDayEndExclusive,
  getUtcDayStart,
  haversineKm,
  toCoordinates as mobileToCoordinates,
} from '@/app/modules/mobile/mobile.helpers';
import {
  MobileManagedPhaseDTO,
  MobileMapProjectDTO,
  MobileScheduleDayDTO,
  MobileSchedulePhaseDTO,
} from '@/app/modules/mobile/mobile.dto';
import {
  AdminProjectAssigneeDTO,
  AdminProjectListDTO,
  AdminProjectPhaseCardDTO,
  AdminProjectTabCountsDTO,
  ProjectCustomerDTO,
  ProjectDetailDTO,
  ProjectPhaseDTO,
  ProjectSummaryDTO,
} from '@/app/modules/project/project.dto';
import {
  enqueuePreTranslate,
  localizeCustomer,
  localizeMany,
  localizeProject,
} from '@/app/services/translation/entityLocalizers';
import {
  aggregateLoggedHours,
  calculateDurationDays,
  selectPrimaryPhase,
  TTimeLogWithBreaks,
} from '@/app/modules/project/project.helpers';
import {
  TCreatePhaseServiceParams,
  TDeleteProjectServiceParams,
  TGetAdminMapServiceParams,
  TGetAdminScheduleServiceParams,
  TGetProjectByIdServiceParams,
  TGetProjectsQuery,
  TListAdminPhasesServiceParams,
  TListProjectsServiceParams,
  TProjectCrewMemberRef,
  TUpdatePhaseStatusServiceParams,
  TUpdateProjectServiceParams,
} from '@/app/modules/project/project.types';

const localizeProjectCustomerRef = async (customer: ProjectCustomerDTO) => {
  const localized = await localizeCustomer({
    id: customer.id,
    name: customer.name,
  });
  customer.name = localized.name;
  customer.localization = localized.localization;
  return customer;
};

const applyProjectLocalization = async <
  T extends ProjectSummaryDTO | ProjectDetailDTO,
>(
  dto: T
): Promise<T> => {
  const localized = await localizeProject({
    id: dto.id,
    name: dto.name,
    siteAccessNotes: dto.siteAccessNotes,
  });
  dto.name = localized.name;
  if (localized.siteAccessNotes !== undefined) {
    dto.siteAccessNotes = localized.siteAccessNotes as string | null;
  }
  dto.localization = localized.localization;
  await localizeProjectCustomerRef(dto.customer);
  return dto;
};

const localizeAdminProjectCard = async (card: AdminProjectPhaseCardDTO) => {
  const localized = await localizeProject({
    id: card.projectId,
    name: card.projectName,
    siteAccessNotes: null,
  });
  card.projectName = localized.name;
  card.localization = localized.localization;
  const custLocalized = await localizeCustomer({
    id: card.customer.id,
    name: card.customer.name,
  });
  card.customer = {
    ...card.customer,
    name: custLocalized.name,
    localization: custLocalized.localization,
  };
  return card;
};

const enqueueProjectPreTranslate = (
  id: string,
  fields: { name?: string; siteAccessNotes?: string | null }
) => {
  const payload: Record<string, string | null | undefined> = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.siteAccessNotes !== undefined) {
    payload.siteAccessNotes = fields.siteAccessNotes;
  }
  if (Object.keys(payload).length === 0) return;
  enqueuePreTranslate({
    contentType: 'PROJECT',
    contentId: id,
    fields: payload,
  });
};

/** Active phase statuses used for admin map pins (mobile parity). */
const ACTIVE_PHASE_STATUSES: PhaseStatus[] = [
  PhaseStatus.IN_PROGRESS,
  PhaseStatus.ORDER_CONFIRMED,
];

/**
 * UTC calendar date key `YYYY-MM-DD`.
 *
 * @param {Date} value - Instant.
 * @returns {string} UTC date key.
 */
const toUtcDateKey = (value: Date): string => {
  return getUtcDayStart(value).toISOString().slice(0, 10);
};

/**
 * Converts a Prisma Decimal (or null) into a plain number (or null).
 *
 * @param {Prisma.Decimal | null | undefined} value - Prisma decimal value.
 * @returns {number | null} Numeric representation or null.
 */
const decimalToNumber = (
  value: Prisma.Decimal | null | undefined
): number | null => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

/**
 * Builds `{ lat, lng }` from nullable decimal coordinates.
 *
 * @param {number | null} lat - Latitude.
 * @param {number | null} lng - Longitude.
 * @returns {{ lat: number; lng: number } | null} Coordinates object or null.
 */
const toCoordinates = (
  lat: number | null,
  lng: number | null
): { lat: number; lng: number } | null => {
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

/**
 * Two-letter initials for avatar chips.
 *
 * @param {string} firstName - First name.
 * @param {string} lastName - Last name.
 * @returns {string} Uppercase initials.
 */
const initialsOf = (firstName: string, lastName: string): string => {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
};

/**
 * Aggregates APPROVED net hours per project id.
 *
 * @param {string[]} projectIds - Project UUIDs.
 * @returns {Promise<Map<string, number>>} Project id → total logged hours.
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
 * Whether a phase card matches an admin list tab.
 *
 * @param {AdminProjectPhaseCardDTO} card - Phase card.
 * @param {TGetProjectsQuery['tab']} tab - Selected tab.
 * @param {boolean} hasPendingInspection - Customer has a pending inspection.
 * @returns {boolean} True when the card belongs in the tab.
 */
const cardMatchesTab = (
  card: AdminProjectPhaseCardDTO,
  tab: TGetProjectsQuery['tab'],
  hasPendingInspection: boolean
): boolean => {
  switch (tab) {
    case 'ACTIVE':
      return (
        card.status === PhaseStatus.IN_PROGRESS ||
        card.status === PhaseStatus.ORDER_CONFIRMED
      );
    case 'INSPECTION':
      return hasPendingInspection;
    case 'URGENT':
      return card.priority === Priority.HIGH;
    case 'COMPLETED':
      return card.status === PhaseStatus.COMPLETED;
    case 'ALL':
    default:
      return true;
  }
};

/**
 * Resolves multi-select phase filters, falling back to legacy single params.
 *
 * @param {TGetProjectsQuery} query - Validated admin list query.
 * @returns {{ types?: PhaseType[]; statuses?: PhaseStatus[]; priorities?: Priority[] }}
 */
const resolvePhaseFilterLists = (
  query: TGetProjectsQuery
): {
  types?: PhaseType[];
  statuses?: PhaseStatus[];
  priorities?: Priority[];
} => {
  const types =
    query.phaseTypes && query.phaseTypes.length > 0
      ? query.phaseTypes
      : query.phaseType
        ? [query.phaseType]
        : undefined;
  const statuses =
    query.phaseStatuses && query.phaseStatuses.length > 0
      ? query.phaseStatuses
      : query.status
        ? [query.status]
        : undefined;
  const priorities =
    query.priorities && query.priorities.length > 0
      ? query.priorities
      : query.priority
        ? [query.priority]
        : undefined;
  return { types, statuses, priorities };
};

/**
 * Whether a phase matches the resolved modal phase filters.
 *
 * @param {{ type: PhaseType; status: PhaseStatus; priority: Priority }} phase - Phase fields.
 * @param {{ types?: PhaseType[]; statuses?: PhaseStatus[]; priorities?: Priority[] }} filters - Lists.
 * @returns {boolean} True when the phase matches (or no filters set).
 */
const phaseMatchesAdminFilters = (
  phase: { type: PhaseType; status: PhaseStatus; priority: Priority },
  filters: {
    types?: PhaseType[];
    statuses?: PhaseStatus[];
    priorities?: Priority[];
  }
): boolean => {
  if (filters.types && !filters.types.includes(phase.type)) return false;
  if (filters.statuses && !filters.statuses.includes(phase.status)) {
    return false;
  }
  if (filters.priorities && !filters.priorities.includes(phase.priority)) {
    return false;
  }
  return true;
};

/**
 * Earliest pending inspection appointment for NEXT_INSPECTION sort.
 *
 * @param {{ appointmentDate: Date }[]} inspections - Pending inspections.
 * @returns {number} Epoch ms or +Infinity when empty.
 */
const nextInspectionSortKey = (
  inspections: Array<{ appointmentDate: Date }>
): number => {
  if (inspections.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...inspections.map((row) => row.appointmentDate.getTime()));
};

/**
 * Lists projects as phase-centric cards for the admin Projects UI.
 * Supports mobile-parity filters (multi-select, geo, sort) plus admin tabs.
 * Returns tab badge counts across the full (pre-pagination) filtered set.
 *
 * @param {TListProjectsServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ data: AdminProjectListDTO; total: number; page: number; limit: number }>}
 * Paginated cards plus total for meta construction.
 */
export const listProjectsService = async ({
  query,
}: TListProjectsServiceParams): Promise<{
  data: AdminProjectListDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, search, tab } = query;
  const sortBy = query.sortBy ?? 'NEWEST';
  const phaseFilters = resolvePhaseFilterLists(query);
  const phaseSome: Prisma.ProjectPhaseWhereInput = {
    ...(phaseFilters.types ? { type: { in: phaseFilters.types } } : {}),
    ...(phaseFilters.statuses
      ? { status: { in: phaseFilters.statuses } }
      : {}),
    ...(phaseFilters.priorities
      ? { priority: { in: phaseFilters.priorities } }
      : {}),
  };
  const hasPhaseFilter = Object.keys(phaseSome).length > 0;

  const and: Prisma.ProjectWhereInput[] = [{ deletedAt: null }];

  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              {
                contacts: {
                  some: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          },
        },
        {
          projectManagers: {
            some: {
              user: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (hasPhaseFilter) {
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

  let projects = await prisma.project.findMany({
    where: { AND: and },
    orderBy: { createdAt: 'desc' },
    include: {
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
        orderBy: { assignedAt: 'asc' },
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      phases: {
        orderBy: { createdAt: 'desc' },
        ...(hasPhaseFilter ? { where: phaseSome } : {}),
      },
      attachments: {
        where: {
          category: AttachmentCategory.PHOTO,
          isCover: true,
        },
        select: { url: true },
        take: 1,
      },
    },
  });

  if (query.lat !== undefined && query.lng !== undefined) {
    const radiusKm = query.radiusKm ?? 25;
    projects = projects.filter((project) => {
      const lat = decimalToNumber(project.latitude);
      const lng = decimalToNumber(project.longitude);
      if (lat === null || lng === null) return false;
      return haversineKm(query.lat!, query.lng!, lat, lng) <= radiusKm;
    });
  }

  const projectIds = projects.map((project) => project.id);
  const loggedByProject = await getLoggedHoursByProjectId(projectIds);

  const crewRows =
    projectIds.length === 0
      ? []
      : await prisma.crewAssignment.findMany({
          where: { phase: { projectId: { in: projectIds } } },
          select: {
            phase: { select: { projectId: true } },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

  const crewByProject = new Map<
    string,
    Map<string, { id: string; firstName: string; lastName: string }>
  >();
  for (const row of crewRows) {
    const projectId = row.phase.projectId;
    const bucket = crewByProject.get(projectId) ?? new Map();
    bucket.set(row.user.id, row.user);
    crewByProject.set(projectId, bucket);
  }

  type TCardMeta = {
    card: AdminProjectPhaseCardDTO;
    hasPendingInspection: boolean;
    createdAtMs: number;
    nextInspectionMs: number;
  };

  const allCards: TCardMeta[] = [];

  for (const project of projects) {
    const matchingPhases = project.phases.filter((phase) =>
      phaseMatchesAdminFilters(phase, phaseFilters)
    );
    if (matchingPhases.length === 0) continue;

    const pm = project.projectManagers[0]?.user;
    const assigneeName = pm ? `${pm.firstName} ${pm.lastName}` : null;
    const logged = loggedByProject.get(project.id) ?? 0;
    const budgeted = Number(project.budgetedHours);
    const coordinates = toCoordinates(
      decimalToNumber(project.latitude),
      decimalToNumber(project.longitude)
    );
    const coverUrl = project.attachments[0]?.url ?? null;
    const hasPendingInspection = project.customer.inspections.length > 0;

    const crewMap = crewByProject.get(project.id) ?? new Map();
    for (const manager of project.projectManagers) {
      crewMap.set(manager.user.id, manager.user);
    }
    const assignedCrew = [...crewMap.values()].map(
      (user) =>
        new AdminProjectAssigneeDTO(
          user.id,
          user.firstName,
          user.lastName,
          initialsOf(user.firstName, user.lastName)
        )
    );

    const phase = selectPrimaryPhase(matchingPhases);
    const card = new AdminProjectPhaseCardDTO(
      phase.id,
      phase.type,
      phase.status,
      phase.priority,
      phase.startDate ? phase.startDate.toISOString() : null,
      phase.endDate ? phase.endDate.toISOString() : null,
      decimalToNumber(phase.durationDays),
      project.id,
      project.name,
      project.address,
      project.city,
      coordinates,
      {
        id: project.customer.id,
        name: project.customer.name,
        category: project.customer.category,
      },
      assigneeName,
      assignedCrew,
      coverUrl,
      budgeted,
      Number(logged.toFixed(2)),
      logged <= budgeted
    );
    allCards.push({
      card,
      hasPendingInspection,
      createdAtMs: project.createdAt.getTime(),
      nextInspectionMs: nextInspectionSortKey(project.customer.inspections),
    });
  }

  const tabCounts = new AdminProjectTabCountsDTO(
    allCards.length,
    allCards.filter(({ card }) =>
      cardMatchesTab(card, 'ACTIVE', false)
    ).length,
    allCards.filter(({ hasPendingInspection }) => hasPendingInspection).length,
    allCards.filter(({ card }) =>
      cardMatchesTab(card, 'URGENT', false)
    ).length,
    allCards.filter(({ card }) =>
      cardMatchesTab(card, 'COMPLETED', false)
    ).length
  );

  const filtered = allCards.filter(({ card, hasPendingInspection }) =>
    cardMatchesTab(card, tab ?? 'ALL', hasPendingInspection)
  );

  if (sortBy === 'NAME_AZ') {
    filtered.sort((a, b) => a.card.projectName.localeCompare(b.card.projectName));
  } else if (sortBy === 'NEXT_INSPECTION') {
    filtered.sort((a, b) => a.nextInspectionMs - b.nextInspectionMs);
  } else {
    filtered.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  const pageSlice = paginateArray(
    filtered.map(({ card }) => card),
    page,
    limit
  );

  const localizedItems = await localizeMany(
    pageSlice.items,
    localizeAdminProjectCard
  );

  return {
    data: new AdminProjectListDTO(localizedItems, tabCounts),
    total: pageSlice.total,
    page: pageSlice.page,
    limit: pageSlice.limit,
  };
};

/**
 * Lists company-wide phases for the admin Kanban / phase board.
 * Optional `column` matches mobile: ENQUIRY → status; others → phase type.
 *
 * @param {TListAdminPhasesServiceParams} params - Validated column/page query.
 * @returns {Promise<{ items: MobileManagedPhaseDTO[]; total: number; page: number; limit: number }>}
 */
export const listAdminPhasesService = async ({
  query,
}: TListAdminPhasesServiceParams): Promise<{
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
    project: { deletedAt: null },
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

  const localizeManagedPhaseProject = async (item: MobileManagedPhaseDTO) => {
    const localized = await localizeProject({
      id: item.project.id,
      name: item.project.name,
    });
    item.project = {
      ...item.project,
      name: localized.name,
      localization: localized.localization,
    };
    return item;
  };

  const items = phases.map(
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

  return {
    items: await localizeMany(items, localizeManagedPhaseProject),
    total,
    page,
    limit,
  };
};

/**
 * Company-wide calendar schedule (mobile `GET /mobile/schedule` parity).
 * Phases overlapping the window, grouped by UTC day. No SM access scoping.
 *
 * @param {TGetAdminScheduleServiceParams} params - Inclusive date window + page.
 * @returns {Promise<{ items: MobileScheduleDayDTO[]; total: number; page: number; limit: number }>}
 */
export const getAdminScheduleService = async ({
  query,
}: TGetAdminScheduleServiceParams): Promise<{
  items: MobileScheduleDayDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const rangeStart = getUtcDayStart(query.startDate);
  const rangeEndExclusive = getUtcDayEndExclusive(
    getUtcDayStart(query.endDate)
  );

  const phases = await prisma.projectPhase.findMany({
    where: {
      startDate: { not: null, lte: query.endDate },
      endDate: { not: null, gte: query.startDate },
      project: { deletedAt: null },
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

  const localizedDays = await Promise.all(
    days.map(async (day) => {
      day.phases = await localizeMany(day.phases, async (phase) => {
        const localized = await localizeProject({
          id: phase.project.id,
          name: phase.project.name,
        });
        phase.project.name = localized.name;
        phase.project.localization = localized.localization;
        return phase;
      });
      return day;
    })
  );

  return paginateArray(localizedDays, page, limit);
};

/**
 * Company-wide map pins for projects with active phases
 * (mobile `GET /mobile/map` parity; no SM access scoping).
 *
 * @param {TGetAdminMapServiceParams} params - Optional phase type + page.
 * @returns {Promise<{ items: MobileMapProjectDTO[]; total: number; page: number; limit: number }>}
 */
export const getAdminMapService = async ({
  query,
}: TGetAdminMapServiceParams): Promise<{
  items: MobileMapProjectDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;

  const phases = await prisma.projectPhase.findMany({
    where: {
      status: { in: ACTIVE_PHASE_STATUSES },
      ...(query.type ? { type: query.type } : {}),
      project: { deletedAt: null },
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
        mobileToCoordinates(
          decimalToNumber(phase.project.latitude),
          decimalToNumber(phase.project.longitude)
        ),
        phase.type
      )
    );
  }

  const pins = await localizeMany([...pinByProject.values()], async (pin) => {
    const localized = await localizeProject({ id: pin.id, name: pin.name });
    pin.name = localized.name;
    pin.localization = localized.localization;
    return pin;
  });

  return paginateArray(pins, page, limit);
};

/**
 * Loads project detail with customer, phases, hour aggregates, and assigned crew.
 * Assumes existence middleware already verified the project.
 *
 * @param {TGetProjectByIdServiceParams} params - Trusted project wrapper.
 * @returns {Promise<ProjectDetailDTO>} Detailed project DTO with analytics.
 */
export const getProjectByIdService = async ({
  project,
}: TGetProjectByIdServiceParams): Promise<ProjectDetailDTO> => {
  const record = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: {
      customer: { select: { id: true, name: true } },
      phases: { orderBy: { createdAt: 'desc' } },
      projectManagers: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  const phaseIds = record.phases.map((phase) => phase.id);

  const [timeLogs, crewAssignments] = await Promise.all([
    phaseIds.length === 0
      ? Promise.resolve([] as TTimeLogWithBreaks[])
      : prisma.timeLog.findMany({
          where: {
            phaseId: { in: phaseIds },
            status: TimeLogStatus.APPROVED,
            endTime: { not: null },
          },
          include: { breaks: true },
        }),
    phaseIds.length === 0
      ? Promise.resolve([])
      : prisma.crewAssignment.findMany({
          where: { phaseId: { in: phaseIds } },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
  ]);

  const { totalLoggedHours, hoursByActivity } = aggregateLoggedHours(
    timeLogs as TTimeLogWithBreaks[]
  );

  const crewById = new Map<string, TProjectCrewMemberRef>();
  for (const assignment of record.projectManagers) {
    crewById.set(assignment.user.id, assignment.user);
  }
  for (const assignment of crewAssignments) {
    crewById.set(assignment.user.id, assignment.user);
  }

  const dto = ProjectDetailDTO.build(
    record,
    totalLoggedHours,
    hoursByActivity,
    [...crewById.values()]
  );

  return applyProjectLocalization(dto);
};

/**
 * Updates project master data (and optionally the most recent phase fields).
 *
 * @param {TUpdateProjectServiceParams} params - Trusted project and payload.
 * @returns {Promise<ProjectSummaryDTO>} Updated project summary DTO.
 */
export const updateProjectService = async ({
  project,
  payload,
}: TUpdateProjectServiceParams): Promise<ProjectSummaryDTO> => {
  const {
    budgetedHours,
    scaffoldArea,
    scaffoldSpecification,
    coordinates,
    city,
    phaseType,
    status,
    priority,
    startDate,
    endDate,
    durationDays,
    safetyInspectionComplete,
    ...rest
  } = payload;

  const resolvedScaffoldArea =
    scaffoldSpecification?.area !== undefined
      ? scaffoldSpecification.area
      : scaffoldArea;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        ...rest,
        ...(city !== undefined ? { city } : {}),
        ...(budgetedHours !== undefined
          ? { budgetedHours: new Prisma.Decimal(budgetedHours) }
          : {}),
        ...(resolvedScaffoldArea !== undefined
          ? {
              scaffoldArea:
                resolvedScaffoldArea === null
                  ? null
                  : new Prisma.Decimal(resolvedScaffoldArea),
            }
          : {}),
        ...(coordinates !== undefined
          ? coordinates === null
            ? { latitude: null, longitude: null }
            : {
                latitude: new Prisma.Decimal(coordinates.lat),
                longitude: new Prisma.Decimal(coordinates.lng),
              }
          : {}),
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

  const updated = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  enqueueProjectPreTranslate(updated.id, {
    ...(rest.name !== undefined ? { name: updated.name } : {}),
    ...(rest.siteAccessNotes !== undefined
      ? { siteAccessNotes: updated.siteAccessNotes }
      : {}),
  });

  return applyProjectLocalization(ProjectSummaryDTO.build(updated));
};

/**
 * Soft-deletes a project (`deletedAt`). Child CRM data remains for audit.
 *
 * @param {TDeleteProjectServiceParams} params - Trusted project.
 * @returns {Promise<{ id: string }>} Soft-deleted project id.
 */
export const deleteProjectService = async ({
  project,
}: TDeleteProjectServiceParams): Promise<{ id: string }> => {
  await prisma.project.update({
    where: { id: project.id },
    data: { deletedAt: new Date() },
  });
  return { id: project.id };
};

/**
 * Creates a new phase under an existing project (defaults to ENQUIRY status).
 *
 * @param {TCreatePhaseServiceParams} params - Trusted project and create payload.
 * @returns {Promise<ProjectPhaseDTO>} Created phase DTO.
 */
export const createPhaseService = async ({
  project,
  payload,
}: TCreatePhaseServiceParams): Promise<ProjectPhaseDTO> => {
  const { startDate, endDate, priority, type } = payload;

  let durationDays: Prisma.Decimal | null | undefined = undefined;
  if (startDate !== undefined && endDate !== undefined) {
    durationDays = new Prisma.Decimal(
      calculateDurationDays(startDate, endDate)
    );
  } else if (startDate !== undefined || endDate !== undefined) {
    durationDays = null;
  }

  const phase = await prisma.projectPhase.create({
    data: {
      projectId: project.id,
      type,
      ...(priority !== undefined ? { priority } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
      ...(durationDays !== undefined ? { durationDays } : {}),
    },
  });

  return ProjectPhaseDTO.build(phase);
};

/**
 * Updates a phase status (Kanban drag-and-drop) with optional schedule/priority/safety.
 * Recalculates `durationDays` when date fields are present in the payload.
 * Writes an `AuditLog` when status, dates, priority, or safety flag actually change.
 *
 * @param {TUpdatePhaseStatusServiceParams} params - Trusted phase, payload, and actor.
 * @returns {Promise<ProjectPhaseDTO>} Updated phase DTO.
 */
export const updatePhaseStatusService = async ({
  phase,
  payload,
  actorUserId,
}: TUpdatePhaseStatusServiceParams): Promise<ProjectPhaseDTO> => {
  const { status, startDate, endDate, priority, safetyInspectionComplete } =
    payload;
  const oldStatus = phase.status;

  const statusChanged = status !== oldStatus;
  const startDateChanged =
    startDate !== undefined &&
    (startDate?.getTime() ?? null) !== (phase.startDate?.getTime() ?? null);
  const endDateChanged =
    endDate !== undefined &&
    (endDate?.getTime() ?? null) !== (phase.endDate?.getTime() ?? null);
  const priorityChanged =
    priority !== undefined && priority !== phase.priority;
  const safetyChanged =
    safetyInspectionComplete !== undefined &&
    safetyInspectionComplete !== phase.safetyInspectionComplete;

  let durationDays: Prisma.Decimal | null | undefined = undefined;
  if (startDate !== undefined && endDate !== undefined) {
    if (startDate !== null && endDate !== null) {
      durationDays = new Prisma.Decimal(
        calculateDurationDays(startDate, endDate)
      );
    } else {
      durationDays = null;
    }
  } else if (startDate !== undefined || endDate !== undefined) {
    durationDays = null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextPhase = await tx.projectPhase.update({
      where: { id: phase.id },
      data: {
        status,
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(durationDays !== undefined ? { durationDays } : {}),
        ...(safetyInspectionComplete !== undefined
          ? { safetyInspectionComplete }
          : {}),
      },
    });

    const shouldAudit =
      statusChanged ||
      startDateChanged ||
      endDateChanged ||
      priorityChanged ||
      safetyChanged;

    if (shouldAudit) {
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          projectId: phase.projectId,
          action: 'PHASE_STATUS_UPDATED',
          details: JSON.stringify({
            from: oldStatus,
            to: status,
            ...(startDateChanged ? { startDate } : {}),
            ...(endDateChanged ? { endDate } : {}),
            ...(priorityChanged ? { priority } : {}),
            ...(safetyChanged ? { safetyInspectionComplete } : {}),
          }),
        },
      });
    }

    return nextPhase;
  });

  return ProjectPhaseDTO.build(updated);
};
