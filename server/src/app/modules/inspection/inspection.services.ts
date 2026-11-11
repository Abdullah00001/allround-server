import { InspectionStatus, PhaseStatus, Prisma } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  ConvertInspectionDTO,
  InspectionDTO,
} from '@/app/modules/inspection/inspection.dto';
import {
  TConvertInspectionServiceParams,
  TCreateInspectionServiceParams,
  TGetInspectionByIdServiceParams,
  TInspectionSiteManagerRef,
  TListInspectionsServiceParams,
  TUpdateInspectionServiceParams,
} from '@/app/modules/inspection/inspection.types';

/**
 * Loads a site-manager projection by user id, or null when absent.
 *
 * @param {string | null | undefined} siteManagerId - Optional user UUID.
 * @returns {Promise<TInspectionSiteManagerRef | null>} Site manager fields or null.
 */
const loadSiteManager = async (
  siteManagerId: string | null | undefined
): Promise<TInspectionSiteManagerRef | null> => {
  if (!siteManagerId) return null;
  const user = await prisma.user.findUnique({
    where: { id: siteManagerId },
    select: { id: true, firstName: true, lastName: true },
  });
  return user;
};

/**
 * Loads site managers for a set of ids in one query and returns a lookup map.
 *
 * @param {Array<string | null>} siteManagerIds - Possibly-null site manager ids.
 * @returns {Promise<Map<string, TInspectionSiteManagerRef>>} Id → user projection map.
 */
const loadSiteManagersMap = async (
  siteManagerIds: Array<string | null>
): Promise<Map<string, TInspectionSiteManagerRef>> => {
  const uniqueIds = [
    ...new Set(siteManagerIds.filter((id): id is string => !!id)),
  ];
  if (uniqueIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  return new Map(users.map((user) => [user.id, user]));
};

/**
 * Creates a new inspection in `PENDING` status.
 *
 * @param {TCreateInspectionServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<InspectionDTO>} Created inspection with customer and site manager.
 */
export const createInspectionService = async ({
  payload,
}: TCreateInspectionServiceParams): Promise<InspectionDTO> => {
  const {
    scaffoldArea,
    scaffoldHeight,
    appointmentDate,
    ...rest
  } = payload;

  const inspection = await prisma.inspection.create({
    data: {
      ...rest,
      appointmentDate,
      scaffoldArea:
        scaffoldArea === undefined
          ? undefined
          : new Prisma.Decimal(scaffoldArea),
      scaffoldHeight:
        scaffoldHeight === undefined
          ? undefined
          : new Prisma.Decimal(scaffoldHeight),
      status: InspectionStatus.PENDING,
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  const siteManager = await loadSiteManager(inspection.siteManagerId);
  return InspectionDTO.build(inspection, siteManager);
};

/**
 * Lists non-deleted inspections with pagination and optional filters.
 *
 * @param {TListInspectionsServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: InspectionDTO[]; total: number; page: number; limit: number }>}
 * Paginated inspection DTOs plus total for meta construction.
 */
export const listInspectionsService = async ({
  query,
}: TListInspectionsServiceParams): Promise<{
  items: InspectionDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, status, customerId } = query;
  const where: Prisma.InspectionWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
  };

  const [total, inspections] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { appointmentDate: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  const siteManagers = await loadSiteManagersMap(
    inspections.map((item) => item.siteManagerId)
  );

  return {
    items: inspections.map((inspection) =>
      InspectionDTO.build(
        inspection,
        inspection.siteManagerId
          ? (siteManagers.get(inspection.siteManagerId) ?? null)
          : null
      )
    ),
    total,
    page,
    limit,
  };
};

/**
 * Loads a single inspection detail.
 * Assumes existence middleware already verified the inspection.
 *
 * @param {TGetInspectionByIdServiceParams} params - Trusted inspection wrapper.
 * @returns {Promise<InspectionDTO>} Inspection detail DTO.
 */
export const getInspectionByIdService = async ({
  inspection,
}: TGetInspectionByIdServiceParams): Promise<InspectionDTO> => {
  const record = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspection.id },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });
  const siteManager = await loadSiteManager(record.siteManagerId);
  return InspectionDTO.build(record, siteManager);
};

/**
 * Updates an existing non-deleted inspection.
 *
 * @param {TUpdateInspectionServiceParams} params - Trusted inspection and payload.
 * @returns {Promise<InspectionDTO>} Updated inspection DTO.
 */
export const updateInspectionService = async ({
  inspection,
  payload,
}: TUpdateInspectionServiceParams): Promise<InspectionDTO> => {
  const {
    scaffoldArea,
    scaffoldHeight,
    appointmentDate,
    ...rest
  } = payload;

  const updated = await prisma.inspection.update({
    where: { id: inspection.id },
    data: {
      ...rest,
      ...(appointmentDate !== undefined ? { appointmentDate } : {}),
      ...(scaffoldArea !== undefined
        ? {
            scaffoldArea:
              scaffoldArea === null ? null : new Prisma.Decimal(scaffoldArea),
          }
        : {}),
      ...(scaffoldHeight !== undefined
        ? {
            scaffoldHeight:
              scaffoldHeight === null
                ? null
                : new Prisma.Decimal(scaffoldHeight),
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  });

  const siteManager = await loadSiteManager(updated.siteManagerId);
  return InspectionDTO.build(updated, siteManager);
};

/**
 * Converts an inspection into a Project + Measurement + initial Phase,
 * then marks the inspection as `CONVERTED` inside one transaction.
 * Assumes convertibility middleware already blocked already-converted rows.
 * Note: Inspection has no lat/long fields; project geo fields stay null.
 *
 * @param {TConvertInspectionServiceParams} params - Trusted inspection and convert payload.
 * @returns {Promise<ConvertInspectionDTO>} Converted inspection plus created project graph.
 */
export const convertInspectionToProjectService = async ({
  inspection,
  payload,
}: TConvertInspectionServiceParams): Promise<ConvertInspectionDTO> => {
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        customerId: inspection.customerId,
        name: payload.projectName,
        address: inspection.address,
      },
    });

    const measurement = await tx.projectMeasurement.create({
      data: {
        projectId: project.id,
        area: new Prisma.Decimal(inspection.scaffoldArea ?? 0),
        height: new Prisma.Decimal(inspection.scaffoldHeight ?? 0),
        scaffoldType: inspection.scaffoldType,
      },
    });

    const phase = await tx.projectPhase.create({
      data: {
        projectId: project.id,
        type: payload.phaseType,
        status: PhaseStatus.ENQUIRY,
      },
    });

    const converted = await tx.inspection.update({
      where: { id: inspection.id },
      data: { status: InspectionStatus.CONVERTED },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });

    return { project, measurement, phase, converted };
  });

  const siteManager = await loadSiteManager(result.converted.siteManagerId);
  const inspectionDto = InspectionDTO.build(result.converted, siteManager);

  return ConvertInspectionDTO.build(
    inspectionDto,
    result.project,
    result.phase,
    result.measurement
  );
};
