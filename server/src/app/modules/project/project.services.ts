import { Prisma, TimeLogStatus } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  ProjectDetailDTO,
  ProjectListItemDTO,
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
  TGetProjectByIdServiceParams,
  TListProjectsServiceParams,
  TProjectCrewMemberRef,
  TUpdatePhaseStatusServiceParams,
  TUpdateProjectServiceParams,
} from '@/app/modules/project/project.types';

/**
 * Lists non-deleted projects with optional name search and pagination.
 * Includes customer name and all phases ordered by `createdAt` desc.
 *
 * @param {TListProjectsServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: ProjectListItemDTO[]; total: number; page: number; limit: number }>}
 * Paginated project rows plus total for meta construction.
 */
export const listProjectsService = async ({
  query,
}: TListProjectsServiceParams): Promise<{
  items: ProjectListItemDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, search } = query;
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        phases: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ]);

  return {
    items: projects.map(ProjectListItemDTO.build),
    total,
    page,
    limit,
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
 * Updates project master data (name, address, budget, site access fields).
 *
 * @param {TUpdateProjectServiceParams} params - Trusted project and payload.
 * @returns {Promise<ProjectSummaryDTO>} Updated project summary DTO.
 */
export const updateProjectService = async ({
  project,
  payload,
}: TUpdateProjectServiceParams): Promise<ProjectSummaryDTO> => {
  const { budgetedHours, ...rest } = payload;

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...rest,
      ...(budgetedHours !== undefined
        ? { budgetedHours: new Prisma.Decimal(budgetedHours) }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  return ProjectSummaryDTO.build(updated);
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
 * Updates a phase status (Kanban drag-and-drop) with optional schedule/priority.
 * Recalculates `durationDays` when date fields are present in the payload.
 * Writes an `AuditLog` when status, dates, or priority actually change.
 *
 * @param {TUpdatePhaseStatusServiceParams} params - Trusted phase, payload, and actor.
 * @returns {Promise<ProjectPhaseDTO>} Updated phase DTO.
 */
export const updatePhaseStatusService = async ({
  phase,
  payload,
  actorUserId,
}: TUpdatePhaseStatusServiceParams): Promise<ProjectPhaseDTO> => {
  const { status, startDate, endDate, priority } = payload;
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
      },
    });

    const shouldAudit =
      statusChanged || startDateChanged || endDateChanged || priorityChanged;

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
          }),
        },
      });
    }

    return nextPhase;
  });

  return ProjectPhaseDTO.build(updated);
};
