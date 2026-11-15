import {
  InspectionStatus,
  PhaseStatus,
  PhaseType,
  Prisma,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  AdminDashboardDTO,
  AdminDashboardMapCountsDTO,
  AdminDashboardMapDTO,
  AdminDashboardMapPinDTO,
  AdminDashboardStatsDTO,
  AdminTodaysOperationDTO,
} from '@/app/modules/dashboard/dashboard.dto';
import { TGetAdminDashboardServiceParams } from '@/app/modules/dashboard/dashboard.types';
import {
  formatUtcDay,
  toUtcDayDate,
  toUtcDayEnd,
} from '@/app/modules/planning/planning.helpers';
import { paginateArray } from '@/app/utils/pagination.utils';

const ACTIVE_PHASE_STATUSES: PhaseStatus[] = [
  PhaseStatus.IN_PROGRESS,
  PhaseStatus.ORDER_CONFIRMED,
];

const PLANNED_PHASE_STATUSES: PhaseStatus[] = [
  PhaseStatus.ENQUIRY,
  PhaseStatus.QUOTATION,
  PhaseStatus.ORDER_CONFIRMED,
];

/**
 * Converts optional Prisma decimals into a coordinates object.
 *
 * @param {Prisma.Decimal | null} latitude - Project latitude.
 * @param {Prisma.Decimal | null} longitude - Project longitude.
 * @returns {{ lat: number; lng: number } | null} Coordinates or null when incomplete.
 */
const toCoordinates = (
  latitude: Prisma.Decimal | null,
  longitude: Prisma.Decimal | null
): { lat: number; lng: number } | null => {
  if (latitude === null || longitude === null) return null;
  return { lat: Number(latitude), lng: Number(longitude) };
};

/**
 * Builds the admin home dashboard: KPI cards, active-project map pins, and
 * today's operations (same overlap rules as `GET /admin/plannings/daily` for UTC today).
 * Only `todaysOperations` is paginated via `page`/`limit`.
 *
 * @param {TGetAdminDashboardServiceParams} params - Validated pagination query.
 * @returns {Promise<{ data: AdminDashboardDTO; total: number; page: number; limit: number }>}
 * Dashboard payload plus meta inputs for today's operations.
 */
export const getAdminDashboardService = async ({
  query,
}: TGetAdminDashboardServiceParams): Promise<{
  data: AdminDashboardDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit } = query;
  const todayKey = formatUtcDay(new Date());
  const dayStart = toUtcDayDate(todayKey);
  const dayEnd = toUtcDayEnd(todayKey);

  const phaseScope = { project: { deletedAt: null } };

  const [
    plannedErections,
    erectionInProgress,
    standingScaffolds,
    plannedDismantling,
    dismantlingInProgress,
    inspectionDue,
    activePhases,
    todayPhases,
  ] = await Promise.all([
    prisma.projectPhase.count({
      where: {
        type: PhaseType.ERECTION,
        status: { in: PLANNED_PHASE_STATUSES },
        ...phaseScope,
      },
    }),
    prisma.projectPhase.count({
      where: {
        type: PhaseType.ERECTION,
        status: PhaseStatus.IN_PROGRESS,
        ...phaseScope,
      },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        phases: {
          some: {
            type: PhaseType.STANDING,
            status: { in: ACTIVE_PHASE_STATUSES },
          },
        },
      },
    }),
    prisma.projectPhase.count({
      where: {
        type: PhaseType.DISMANTLING,
        status: { in: PLANNED_PHASE_STATUSES },
        ...phaseScope,
      },
    }),
    prisma.projectPhase.count({
      where: {
        type: PhaseType.DISMANTLING,
        status: PhaseStatus.IN_PROGRESS,
        ...phaseScope,
      },
    }),
    prisma.inspection.count({
      where: {
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
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { startDate: 'asc' }],
    }),
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
            customer: { select: { name: true } },
            projectManagers: {
              take: 1,
              orderBy: { assignedAt: 'asc' },
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        crewAssignments: {
          where: { date: dayStart },
          select: { id: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  const pinByProject = new Map<string, AdminDashboardMapPinDTO>();
  for (const phase of activePhases) {
    if (pinByProject.has(phase.project.id)) continue;
    pinByProject.set(
      phase.project.id,
      new AdminDashboardMapPinDTO(
        phase.project.id,
        phase.project.name,
        toCoordinates(phase.project.latitude, phase.project.longitude),
        phase.type
      )
    );
  }

  const pins = [...pinByProject.values()];
  let erectionPins = 0;
  let standingPins = 0;
  let dismantlingPins = 0;
  for (const pin of pins) {
    if (pin.phaseType === PhaseType.ERECTION) erectionPins += 1;
    else if (pin.phaseType === PhaseType.STANDING) standingPins += 1;
    else if (pin.phaseType === PhaseType.DISMANTLING) dismantlingPins += 1;
  }

  const operations = todayPhases.map((phase) => {
    const manager = phase.project.projectManagers[0]?.user;
    return new AdminTodaysOperationDTO(
      phase.id,
      phase.project.id,
      phase.project.name,
      phase.project.customer.name,
      manager ? `${manager.firstName} ${manager.lastName}` : null,
      phase.type,
      phase.crewAssignments.length
    );
  });

  const operationsPage = paginateArray(operations, page, limit);

  return {
    data: new AdminDashboardDTO(
      new AdminDashboardStatsDTO(
        plannedErections,
        erectionInProgress,
        standingScaffolds,
        plannedDismantling,
        dismantlingInProgress,
        inspectionDue
      ),
      new AdminDashboardMapDTO(
        new AdminDashboardMapCountsDTO(
          erectionPins,
          standingPins,
          dismantlingPins
        ),
        pins
      ),
      operationsPage.items
    ),
    total: operationsPage.total,
    page,
    limit,
  };
};
