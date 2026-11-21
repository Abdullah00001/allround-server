import {
  AttachmentCategory,
  Inspection,
  InspectionStatus,
  NotificationType,
  PhaseStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import {
  ConvertInspectionDTO,
  InspectionDTO,
  InspectionListDTO,
  InspectionListStatsDTO,
  InspectionTabCountsDTO,
} from '@/app/modules/inspection/inspection.dto';
import {
  TConvertInspectionServiceParams,
  TCreateInspectionServiceParams,
  TDeleteInspectionServiceParams,
  TGetInspectionByIdServiceParams,
  TInspectionSiteManagerRef,
  TListInspectionsServiceParams,
  TUpdateInspectionServiceParams,
} from '@/app/modules/inspection/inspection.types';
import { triggerPushNotification } from '@/app/utils/notification.utils';
import {
  getUtcDayEndExclusive,
  getUtcDayStart,
} from '@/app/modules/mobile/mobile.helpers';
import {
  enqueuePreTranslate,
  localizeCustomer,
  localizeInspection,
  localizeMany,
  localizeProject,
  localizeProjectMeasurement,
} from '@/app/services/translation/entityLocalizers';

const enqueueInspectionPreTranslate = (
  row: Pick<
    Inspection,
    | 'id'
    | 'siteTitle'
    | 'siteAccessInstructions'
    | 'specialRequirements'
    | 'scaffoldType'
  >
) => {
  enqueuePreTranslate({
    contentType: 'INSPECTION',
    contentId: row.id,
    fields: {
      siteTitle: row.siteTitle,
      siteAccessInstructions: row.siteAccessInstructions,
      specialRequirements: row.specialRequirements,
      scaffoldType: row.scaffoldType,
    },
  });
};

const enqueuePrimaryContactPreTranslate = async (customerId: string) => {
  const primary = await prisma.customerContact.findFirst({
    where: { customerId, isPrimary: true },
    select: { id: true, name: true, role: true },
  });
  if (!primary) return;
  enqueuePreTranslate({
    contentType: 'CUSTOMER_CONTACT',
    contentId: primary.id,
    fields: { name: primary.name, role: primary.role },
  });
};

const localizeInspectionDto = async (dto: InspectionDTO) => {
  const localized = await localizeInspection({
    id: dto.id,
    siteTitle: dto.siteTitle,
    siteAccessInstructions: dto.siteAccessInstructions,
    specialRequirements: dto.specialRequirements,
    scaffoldType: dto.scaffoldType,
  });
  dto.siteTitle = localized.siteTitle;
  dto.siteAccessInstructions = localized.siteAccessInstructions as
    | string
    | null;
  dto.specialRequirements = localized.specialRequirements as string | null;
  dto.scaffoldType = localized.scaffoldType as string | null;
  dto.localization = localized.localization;

  const customerLocalized = await localizeCustomer({
    id: dto.customer.id,
    name: dto.customer.name,
  });
  dto.customer.name = customerLocalized.name;
  dto.customer.localization = customerLocalized.localization;
  return dto;
};

const localizeConvertInspectionDto = async (
  dto: ConvertInspectionDTO
): Promise<ConvertInspectionDTO> => {
  const [projectLocalized, clientLocalized, measurementLocalized] =
    await Promise.all([
      localizeProject({
        id: dto.project.id,
        name: dto.project.name,
        siteAccessNotes: null,
      }),
      localizeCustomer({
        id: dto.project.client.id,
        name: dto.project.client.name,
      }),
      dto.measurement
        ? localizeProjectMeasurement({
            id: dto.measurement.id,
            position: null,
            remark: null,
            scaffoldType: dto.measurement.scaffoldType,
          })
        : Promise.resolve(null),
    ]);

  const measurement =
    dto.measurement && measurementLocalized
      ? {
          ...dto.measurement,
          scaffoldType:
            (measurementLocalized.scaffoldType as string | null) ??
            dto.measurement.scaffoldType,
          localization: measurementLocalized.localization,
        }
      : dto.measurement;

  return Object.assign(dto, {
    project: {
      ...dto.project,
      name: projectLocalized.name,
      localization: projectLocalized.localization,
      client: {
        ...dto.project.client,
        name: clientLocalized.name,
        localization: clientLocalized.localization,
      },
      specs: measurement
        ? {
            ...dto.project.specs,
            scaffoldType: measurement.scaffoldType,
          }
        : dto.project.specs,
    },
    measurement,
  });
};

const photoInclude = {
  where: { category: AttachmentCategory.PHOTO },
  select: { id: true, url: true, fileType: true, fileName: true },
  orderBy: { createdAt: 'asc' as const },
  take: 6,
} as const;

const inspectionInclude = {
  customer: { select: { id: true, name: true } },
  attachments: photoInclude,
  _count: {
    select: {
      attachments: { where: { category: AttachmentCategory.PHOTO } },
    },
  },
} as const;

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
 * Builds the search/customer filter shared by list rows and aggregate stats.
 *
 * @param {TListInspectionsServiceParams['query']} query - List query.
 * @returns {Prisma.InspectionWhereInput} Base where (no status tab filter).
 */
const buildInspectionBaseWhere = (
  query: TListInspectionsServiceParams['query']
): Prisma.InspectionWhereInput => {
  const { customerId, search, startDate, endDate } = query;
  return {
    deletedAt: null,
    ...(customerId ? { customerId } : {}),
    ...(search
      ? {
          customer: {
            name: { contains: search, mode: 'insensitive' },
            deletedAt: null,
          },
        }
      : {}),
    ...(startDate !== undefined && endDate !== undefined
      ? {
          appointmentDate: {
            gte: getUtcDayStart(startDate),
            lt: getUtcDayEndExclusive(getUtcDayStart(endDate)),
          },
        }
      : {}),
  };
};

/**
 * Upserts a primary contact for a customer when the form sends contact fields.
 *
 * @param {Prisma.TransactionClient} tx - Prisma transaction client.
 * @param {string} customerId - Target customer UUID.
 * @param {{ name: string; phone?: string; email?: string; role?: string }} contact - Contact payload.
 * @returns {Promise<void>}
 */
const upsertPrimaryContact = async (
  tx: Prisma.TransactionClient,
  customerId: string,
  contact: { name: string; phone?: string; email?: string; role?: string }
): Promise<void> => {
  const existingPrimary = await tx.customerContact.findFirst({
    where: { customerId, isPrimary: true },
    select: { id: true },
  });

  if (existingPrimary) {
    await tx.customerContact.update({
      where: { id: existingPrimary.id },
      data: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        role: contact.role ?? 'Project lead',
      },
    });
    return;
  }

  await tx.customerContact.create({
    data: {
      customerId,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      role: contact.role ?? 'Project lead',
      isPrimary: true,
    },
  });
};

/**
 * Replaces all PHOTO attachments on an inspection with the provided list.
 *
 * @param {Prisma.TransactionClient} tx - Prisma transaction client.
 * @param {string} inspectionId - Inspection UUID.
 * @param {Array<{ url: string; fileType: string; fileName?: string; fileSize?: number }>} photos - New photos.
 * @returns {Promise<void>}
 */
const replaceInspectionPhotos = async (
  tx: Prisma.TransactionClient,
  inspectionId: string,
  photos: Array<{
    url: string;
    fileType: string;
    fileName?: string;
    fileSize?: number;
  }>
): Promise<void> => {
  await tx.attachment.deleteMany({
    where: {
      inspectionId,
      category: AttachmentCategory.PHOTO,
    },
  });

  if (photos.length === 0) return;

  await tx.attachment.createMany({
    data: photos.map((photo) => ({
      url: photo.url,
      fileType: photo.fileType,
      fileName: photo.fileName,
      fileSize: photo.fileSize,
      category: AttachmentCategory.PHOTO,
      inspectionId,
    })),
  });
};

/**
 * Creates a new inspection in `PENDING` status.
 * Supports EXISTING or NEW customer (with optional primary contact) and optional photos.
 *
 * @param {TCreateInspectionServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<InspectionDTO>} Created inspection with customer, site manager, photos.
 */
export const createInspectionService = async ({
  payload,
}: TCreateInspectionServiceParams): Promise<InspectionDTO> => {
  const {
    customer: customerInput,
    contact,
    photos,
    scaffoldArea,
    scaffoldHeight,
    appointmentDate,
    siteManagerId,
    siteTitle,
    address,
    postalCode,
    city,
    scaffoldType,
    siteAccessInstructions,
    specialRequirements,
  } = payload;

  const inspection = await prisma.$transaction(async (tx) => {
    let customerId: string;

    if (customerInput.mode === 'EXISTING') {
      customerId = customerInput.customerId;
    } else {
      const createdCustomer = await tx.customer.create({
        data: {
          name: customerInput.name,
          category: customerInput.category,
          address,
        },
      });
      customerId = createdCustomer.id;
    }

    if (contact) {
      await upsertPrimaryContact(tx, customerId, contact);
    }

    const created = await tx.inspection.create({
      data: {
        customerId,
        siteManagerId,
        siteTitle,
        address,
        postalCode,
        city,
        appointmentDate,
        scaffoldType,
        siteAccessInstructions,
        specialRequirements,
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
    });

    if (photos && photos.length > 0) {
      await tx.attachment.createMany({
        data: photos.map((photo) => ({
          url: photo.url,
          fileType: photo.fileType,
          fileName: photo.fileName,
          fileSize: photo.fileSize,
          category: AttachmentCategory.PHOTO,
          inspectionId: created.id,
        })),
      });
    }

    return tx.inspection.findUniqueOrThrow({
      where: { id: created.id },
      include: inspectionInclude,
    });
  });

  const siteManager = await loadSiteManager(inspection.siteManagerId);
  enqueueInspectionPreTranslate(inspection);
  if (customerInput.mode === 'NEW') {
    enqueuePreTranslate({
      contentType: 'CUSTOMER',
      contentId: inspection.customerId,
      fields: { name: inspection.customer.name },
    });
  }
  if (contact) {
    await enqueuePrimaryContactPreTranslate(inspection.customerId);
  }

  return localizeInspectionDto(
    InspectionDTO.build(inspection, siteManager)
  );
};

/**
 * Lists non-deleted inspections with pagination, search, KPI stats, and tab counts.
 *
 * @param {TListInspectionsServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ data: InspectionListDTO; total: number; page: number; limit: number }>}
 * List payload plus pagination inputs for meta.
 */
export const listInspectionsService = async ({
  query,
}: TListInspectionsServiceParams): Promise<{
  data: InspectionListDTO;
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, status } = query;
  const baseWhere = buildInspectionBaseWhere(query);
  const where: Prisma.InspectionWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const [
    total,
    inspections,
    totalInspections,
    areaAgg,
    heightAgg,
    awaitingSurvey,
    surveysCompleted,
    converted,
  ] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { appointmentDate: 'desc' },
      include: inspectionInclude,
    }),
    prisma.inspection.count({ where: baseWhere }),
    prisma.inspection.aggregate({
      where: baseWhere,
      _sum: { scaffoldArea: true },
    }),
    prisma.inspection.aggregate({
      where: { ...baseWhere, scaffoldHeight: { not: null } },
      _avg: { scaffoldHeight: true },
    }),
    prisma.inspection.count({
      where: { ...baseWhere, status: InspectionStatus.PENDING },
    }),
    prisma.inspection.count({
      where: { ...baseWhere, status: InspectionStatus.SURVEY_DONE },
    }),
    prisma.inspection.count({
      where: { ...baseWhere, status: InspectionStatus.CONVERTED },
    }),
  ]);

  const siteManagers = await loadSiteManagersMap(
    inspections.map((item) => item.siteManagerId)
  );

  const items = await localizeMany(
    inspections.map((inspection) =>
      InspectionDTO.build(
        inspection,
        inspection.siteManagerId
          ? (siteManagers.get(inspection.siteManagerId) ?? null)
          : null
      )
    ),
    localizeInspectionDto
  );

  const totalSpecsArea = Number(
    (areaAgg._sum.scaffoldArea ? Number(areaAgg._sum.scaffoldArea) : 0).toFixed(
      2
    )
  );
  const avgScaffoldHeight =
    heightAgg._avg.scaffoldHeight === null
      ? null
      : Number(Number(heightAgg._avg.scaffoldHeight).toFixed(2));

  return {
    data: new InspectionListDTO(
      items,
      new InspectionListStatsDTO(
        totalInspections,
        totalSpecsArea,
        avgScaffoldHeight,
        awaitingSurvey,
        surveysCompleted
      ),
      new InspectionTabCountsDTO(
        totalInspections,
        awaitingSurvey,
        surveysCompleted,
        converted
      )
    ),
    total,
    page,
    limit,
  };
};

/**
 * Loads a single inspection detail with photos.
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
    include: inspectionInclude,
  });
  const siteManager = await loadSiteManager(record.siteManagerId);
  return localizeInspectionDto(InspectionDTO.build(record, siteManager));
};

/**
 * Updates an existing non-deleted inspection.
 * Optional `photos` replaces all PHOTO attachments. Optional `contact` upserts primary contact.
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
    photos,
    contact,
    siteAccessInstructions,
    specialRequirements,
    ...rest
  } = payload;

  const updated = await prisma.$transaction(async (tx) => {
    if (contact) {
      await upsertPrimaryContact(tx, inspection.customerId, contact);
    }

    if (photos !== undefined) {
      await replaceInspectionPhotos(tx, inspection.id, photos);
    }

    await tx.inspection.update({
      where: { id: inspection.id },
      data: {
        ...rest,
        ...(appointmentDate !== undefined ? { appointmentDate } : {}),
        ...(siteAccessInstructions !== undefined
          ? { siteAccessInstructions }
          : {}),
        ...(specialRequirements !== undefined ? { specialRequirements } : {}),
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
    });

    return tx.inspection.findUniqueOrThrow({
      where: { id: inspection.id },
      include: inspectionInclude,
    });
  });

  const siteManager = await loadSiteManager(updated.siteManagerId);
  enqueueInspectionPreTranslate(updated);
  if (contact) {
    await enqueuePrimaryContactPreTranslate(inspection.customerId);
  }

  return localizeInspectionDto(InspectionDTO.build(updated, siteManager));
};

/**
 * Soft-deletes an inspection. Blocked when status is `CONVERTED`.
 *
 * @param {TDeleteInspectionServiceParams} params - Trusted inspection.
 * @returns {Promise<{ id: string }>} Deleted inspection id.
 */
export const deleteInspectionService = async ({
  inspection,
}: TDeleteInspectionServiceParams): Promise<{ id: string }> => {
  await prisma.inspection.update({
    where: { id: inspection.id },
    data: { deletedAt: new Date() },
  });

  return { id: inspection.id };
};

/**
 * Converts an inspection into a Project + Measurement + initial Phase,
 * assigns the site manager as PM (mobile parity), then marks `CONVERTED`.
 * Assumes convertibility middleware already blocked already-converted rows.
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
        city: inspection.city,
        scaffoldArea: inspection.scaffoldArea,
        siteAccessNotes: inspection.siteAccessInstructions,
      },
    });

    const measurement = await tx.projectMeasurement.create({
      data: {
        projectId: project.id,
        length: new Prisma.Decimal(0),
        area: new Prisma.Decimal(inspection.scaffoldArea ?? 0),
        height: new Prisma.Decimal(inspection.scaffoldHeight ?? 0),
        quantity: new Prisma.Decimal(1),
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

    if (inspection.siteManagerId) {
      await tx.projectManagerAssignment.create({
        data: {
          projectId: project.id,
          userId: inspection.siteManagerId,
        },
      });
    }

    const converted = await tx.inspection.update({
      where: { id: inspection.id },
      data: {
        status: InspectionStatus.CONVERTED,
        projectId: project.id,
      },
      include: inspectionInclude,
    });

    return { project, measurement, phase, converted };
  });

  const siteManager = await loadSiteManager(result.converted.siteManagerId);
  const inspectionDto = await localizeInspectionDto(
    InspectionDTO.build(result.converted, siteManager)
  );

  enqueuePreTranslate({
    contentType: 'PROJECT',
    contentId: result.project.id,
    fields: {
      name: result.project.name,
      siteAccessNotes: result.project.siteAccessNotes,
    },
  });
  enqueuePreTranslate({
    contentType: 'PROJECT_MEASUREMENT',
    contentId: result.measurement.id,
    fields: {
      position: result.measurement.position,
      remark: result.measurement.remark,
      scaffoldType: result.measurement.scaffoldType,
    },
  });

  if (result.converted.siteManagerId) {
    await triggerPushNotification(
      [result.converted.siteManagerId],
      NotificationType.INSPECTION_SCHEDULED,
      'notification.inspection_scheduled.title',
      'notification.inspection_scheduled.body',
      {
        siteTitle: result.converted.siteTitle,
        projectName: result.project.name,
      }
    );
  }

  const response = ConvertInspectionDTO.build(
    inspectionDto,
    result.project,
    result.converted.customer,
    result.phase,
    result.measurement
  );
  return localizeConvertInspectionDto(response);
};
