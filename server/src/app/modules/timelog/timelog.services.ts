import { NotificationType, TimeLogStatus } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { TimeLogDTO } from '@/app/modules/timelog/timelog.dto';
import {
  TCreateTimeLogServiceParams,
  TListTimeLogsServiceParams,
  TTimeLogMutationServiceParams,
  TUpdateTimeLogServiceParams,
} from '@/app/modules/timelog/timelog.types';
import { triggerPushNotification } from '@/app/utils/notification.utils';

const timeLogInclude = {
  breaks: true,
  user: { select: { id: true, firstName: true, lastName: true } },
  phase: {
    select: {
      id: true,
      type: true,
      project: { select: { id: true, name: true } },
    },
  },
} as const;

/**
 * Lists time logs with filters, pagination, nested user/phase, and netHours.
 *
 * @param {TListTimeLogsServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: TimeLogDTO[]; total: number; page: number; limit: number }>}
 * Paginated time-log DTOs plus total for meta construction.
 */
export const listTimeLogsService = async ({
  query,
}: TListTimeLogsServiceParams): Promise<{
  items: TimeLogDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, projectId, userId, status, startDate, endDate } = query;

  const where = {
    ...(userId ? { userId } : {}),
    ...(status ? { status } : {}),
    ...(projectId
      ? {
          phase: {
            projectId,
          },
        }
      : {}),
    ...(startDate || endDate
      ? {
          startTime: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const [total, timeLogs] = await Promise.all([
    prisma.timeLog.count({ where }),
    prisma.timeLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startTime: 'desc' },
      include: timeLogInclude,
    }),
  ]);

  return {
    items: timeLogs.map(TimeLogDTO.build),
    total,
    page,
    limit,
  };
};

/**
 * Creates a manual admin time log as `APPROVED` with optional break minutes.
 *
 * @param {TCreateTimeLogServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<TimeLogDTO>} Created time-log DTO.
 */
export const createTimeLogService = async ({
  payload,
}: TCreateTimeLogServiceParams): Promise<TimeLogDTO> => {
  const { breakMinutes, startTime, endTime, ...rest } = payload;

  const breakEnd =
    breakMinutes > 0
      ? new Date(startTime.getTime() + breakMinutes * 60 * 1000)
      : null;

  const timeLog = await prisma.timeLog.create({
    data: {
      ...rest,
      startTime,
      endTime,
      isManual: true,
      status: TimeLogStatus.APPROVED,
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

  return TimeLogDTO.build(timeLog);
};

/**
 * Approves a pending time log.
 * Assumes pending-status middleware already gated the transition.
 *
 * @param {TTimeLogMutationServiceParams} params - Trusted time log wrapper.
 * @returns {Promise<TimeLogDTO>} Updated time-log DTO.
 */
export const approveTimeLogService = async ({
  timeLog,
}: TTimeLogMutationServiceParams): Promise<TimeLogDTO> => {
  const updated = await prisma.timeLog.update({
    where: { id: timeLog.id },
    data: { status: TimeLogStatus.APPROVED },
    include: timeLogInclude,
  });

  await triggerPushNotification(
    [timeLog.userId],
    NotificationType.TIME_LOG_APPROVED,
    'notification.time_log_approved.title',
    'notification.time_log_approved.body',
    { date: timeLog.startTime.toISOString().slice(0, 10) }
  );

  return TimeLogDTO.build(updated);
};

/**
 * Rejects a pending time log.
 * Assumes pending-status middleware already gated the transition.
 *
 * @param {TTimeLogMutationServiceParams} params - Trusted time log wrapper.
 * @returns {Promise<TimeLogDTO>} Updated time-log DTO.
 */
export const rejectTimeLogService = async ({
  timeLog,
}: TTimeLogMutationServiceParams): Promise<TimeLogDTO> => {
  const updated = await prisma.timeLog.update({
    where: { id: timeLog.id },
    data: { status: TimeLogStatus.REJECTED },
    include: timeLogInclude,
  });

  await triggerPushNotification(
    [timeLog.userId],
    NotificationType.TIME_LOG_REJECTED,
    'notification.time_log_rejected.title',
    'notification.time_log_rejected.body',
    { date: timeLog.startTime.toISOString().slice(0, 10) }
  );

  return TimeLogDTO.build(updated);
};

/**
 * Hard-deletes a time log (breaks cascade via Prisma relation).
 *
 * @param {TTimeLogMutationServiceParams} params - Trusted time log wrapper.
 * @returns {Promise<{ id: string }>} Deleted time log id.
 */
export const deleteTimeLogService = async ({
  timeLog,
}: TTimeLogMutationServiceParams): Promise<{ id: string }> => {
  await prisma.timeLog.delete({
    where: { id: timeLog.id },
  });
  return { id: timeLog.id };
};

/**
 * Applies an admin partial update to a time log.
 * When `breakMinutes` is provided, existing breaks are replaced with a single
 * synthetic break starting at the (possibly updated) start time.
 * Persists `editReason` when `reason` is supplied (after policy middleware).
 *
 * @param {TUpdateTimeLogServiceParams} params - Trusted time log and payload.
 * @returns {Promise<TimeLogDTO>} Updated time-log DTO.
 */
export const updateTimeLogService = async ({
  timeLog,
  payload,
}: TUpdateTimeLogServiceParams): Promise<TimeLogDTO> => {
  const nextStartTime = payload.startTime ?? timeLog.startTime;
  const nextEndTime =
    payload.endTime !== undefined ? payload.endTime : timeLog.endTime;

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.breakMinutes !== undefined) {
      await tx.timeLogBreak.deleteMany({ where: { timeLogId: timeLog.id } });

      if (payload.breakMinutes > 0 && nextEndTime) {
        const breakEnd = new Date(
          nextStartTime.getTime() + payload.breakMinutes * 60 * 1000
        );
        await tx.timeLogBreak.create({
          data: {
            timeLogId: timeLog.id,
            startTime: nextStartTime,
            endTime: breakEnd,
            durationMinutes: payload.breakMinutes,
          },
        });
      }
    }

    return tx.timeLog.update({
      where: { id: timeLog.id },
      data: {
        ...(payload.activityType !== undefined
          ? { activityType: payload.activityType }
          : {}),
        ...(payload.startTime !== undefined
          ? { startTime: payload.startTime }
          : {}),
        ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
        ...(payload.reason !== undefined
          ? { editReason: payload.reason }
          : {}),
      },
      include: timeLogInclude,
    });
  });

  return TimeLogDTO.build(updated);
};
