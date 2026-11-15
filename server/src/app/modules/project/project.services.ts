import {
  AttachmentCategory,
  InspectionStatus,
  PhaseStatus,
  Prisma,
  Priority,
  TimeLogStatus,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { paginateArray } from '@/app/utils/pagination.utils';
import {
  AdminProjectAssigneeDTO,
  AdminProjectListDTO,
  AdminProjectPhaseCardDTO,
  AdminProjectTabCountsDTO,
  ProjectDetailDTO,
  ProjectPhaseDTO,
  ProjectSummaryDTO,
} from '@/app/modules/project/project.dto';
import {
  aggregateLoggedHours,
  calculateDurationDays,
  TTimeLogWithBreaks,
} from '@/app/modules/project/project.helpers';
import {
  TCreatePhaseServiceParams,
  TDeleteProjectServiceParams,
  TGetProjectByIdServiceParams,
  TGetProjectsQuery,
  TListProjectsServiceParams,
  TProjectCrewMemberRef,
  TUpdatePhaseStatusServiceParams,
  TUpdateProjectServiceParams,
} from '@/app/modules/project/project.types';

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
 * Lists projects as phase-centric cards for the admin Projects UI.
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
  const { page, limit, search, tab, phaseType, status, priority } = query;

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...(search
      ? {
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
                      {
                        firstName: { contains: search, mode: 'insensitive' },
                      },
                      {
                        lastName: { contains: search, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(phaseType || status || priority
      ? {
          phases: {
            some: {
              ...(phaseType ? { type: phaseType } : {}),
              ...(status ? { status } : {}),
              ...(priority ? { priority } : {}),
            },
          },
        }
      : {}),
  };

  const projects = await prisma.project.findMany({
    where,
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
            select: { id: true },
            take: 1,
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
        ...(phaseType || status || priority
          ? {
              where: {
                ...(phaseType ? { type: phaseType } : {}),
                ...(status ? { status } : {}),
                ...(priority ? { priority } : {}),
              },
            }
          : {}),
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

  const projectIds = projects.map((project) => project.id);
  const loggedByProject = await getLoggedHoursByProjectId(projectIds);

  // Crew avatars: distinct users from crew assignments across project phases.
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
  };

  const allCards: TCardMeta[] = [];

  for (const project of projects) {
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

    for (const phase of project.phases) {
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
      allCards.push({ card, hasPendingInspection });
    }
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

  const filtered = allCards
    .filter(({ card, hasPendingInspection }) =>
      cardMatchesTab(card, tab ?? 'ALL', hasPendingInspection)
    )
    .map(({ card }) => card);

  const pageSlice = paginateArray(filtered, page, limit);

  return {
    data: new AdminProjectListDTO(pageSlice.items, tabCounts),
    total: pageSlice.total,
    page: pageSlice.page,
    limit: pageSlice.limit,
  };
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

  return ProjectDetailDTO.build(
    record,
    totalLoggedHours,
    hoursByActivity,
    [...crewById.values()]
  );
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

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: project.id },
      data: {
        ...rest,
        ...(city !== undefined ? { city } : {}),
        ...(budgetedHours !== undefined
          ? { budgetedHours: new Prisma.Decimal(budgetedHours) }
          : {}),
        ...(scaffoldArea !== undefined
          ? {
              scaffoldArea:
                scaffoldArea === null
                  ? null
                  : new Prisma.Decimal(scaffoldArea),
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

  return ProjectSummaryDTO.build(updated);
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
