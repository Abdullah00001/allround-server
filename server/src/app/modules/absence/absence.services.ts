import prisma from '@/app/configs/db.configs';
import { AbsenceDTO } from '@/app/modules/absence/absence.dto';
import {
  TCreateAbsenceServiceParams,
  TDeleteAbsenceServiceParams,
  TListAbsencesServiceParams,
} from '@/app/modules/absence/absence.types';

const absenceInclude = {
  user: { select: { id: true, firstName: true, lastName: true } },
} as const;

/**
 * Lists absences with optional user and overlapping date-range filters.
 *
 * @param {TListAbsencesServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: AbsenceDTO[]; total: number; page: number; limit: number }>}
 * Paginated absence DTOs plus total for meta construction.
 */
export const listAbsencesService = async ({
  query,
}: TListAbsencesServiceParams): Promise<{
  items: AbsenceDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, userId, startDate, endDate } = query;

  const where = {
    ...(userId ? { userId } : {}),
    ...(startDate || endDate
      ? {
          AND: [
            ...(startDate ? [{ endDate: { gte: startDate } }] : []),
            ...(endDate ? [{ startDate: { lte: endDate } }] : []),
          ],
        }
      : {}),
  };

  const [total, absences] = await Promise.all([
    prisma.absence.count({ where }),
    prisma.absence.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startDate: 'desc' },
      include: absenceInclude,
    }),
  ]);

  return {
    items: absences.map(AbsenceDTO.build),
    total,
    page,
    limit,
  };
};

/**
 * Creates a new absence for an employee.
 * Assumes Zod already enforced startDate before endDate and user middleware verified the user.
 *
 * @param {TCreateAbsenceServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<AbsenceDTO>} Created absence DTO.
 */
export const createAbsenceService = async ({
  payload,
}: TCreateAbsenceServiceParams): Promise<AbsenceDTO> => {
  const absence = await prisma.absence.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      startDate: payload.startDate,
      endDate: payload.endDate,
      note: payload.note,
    },
    include: absenceInclude,
  });

  return AbsenceDTO.build(absence);
};

/**
 * Hard-deletes (cancels) an absence.
 *
 * @param {TDeleteAbsenceServiceParams} params - Trusted absence wrapper.
 * @returns {Promise<{ id: string }>} Deleted absence id.
 */
export const deleteAbsenceService = async ({
  absence,
}: TDeleteAbsenceServiceParams): Promise<{ id: string }> => {
  await prisma.absence.delete({
    where: { id: absence.id },
  });
  return { id: absence.id };
};
