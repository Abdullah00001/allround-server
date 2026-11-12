import { NotificationType, TimeLogStatus } from '@prisma/client';
import { ICronJob } from '@/app/@types/job.types';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { triggerPushNotification } from '@/app/utils/notification.utils';

/**
 * Builds today's 23:59:00.000 in Europe/Berlin as a Date.
 *
 * @returns {Date} Local end-of-day instant converted to UTC Date.
 */
const getBerlinEndOfDay = (): Date => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  // Interpret Berlin civil date 23:59 as an absolute instant via offset lookup.
  const probe = new Date(`${year}-${month}-${day}T23:59:00`);
  const berlinOffsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  });
  const offsetPart =
    berlinOffsetFormatter
      .formatToParts(probe)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = offsetPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  const hours = match ? Number(match[1]) : 0;
  const minutes = match?.[2] ? Number(match[2]) : 0;
  const offsetMinutes = hours * 60 + Math.sign(hours || 1) * minutes;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 0, 0) -
      offsetMinutes * 60 * 1000
  );
};

/**
 * Closes open timers at end of day and notifies owners.
 */
const autoCloseDanglingTimersJob: ICronJob = {
  name: 'auto-close-dangling-timers',
  schedule: '59 23 * * *',
  execute: async () => {
    const endTime = getBerlinEndOfDay();
    const openLogs = await prisma.timeLog.findMany({
      where: { endTime: null },
      select: { id: true, userId: true },
    });

    if (openLogs.length === 0) {
      logger.info('[auto-close-dangling-timers] No open timers found');
      return;
    }

    await prisma.timeLog.updateMany({
      where: { id: { in: openLogs.map((log) => log.id) } },
      data: {
        endTime,
        status: TimeLogStatus.PENDING_APPROVAL,
      },
    });

    const ownerIds = [...new Set(openLogs.map((log) => log.userId))];
    await triggerPushNotification(
      ownerIds,
      NotificationType.SYSTEM_ALERT,
      'notification.timer_auto_closed.title',
      'notification.timer_auto_closed.body'
    );

    logger.info(
      `[auto-close-dangling-timers] Closed ${openLogs.length} timers for ${ownerIds.length} users`
    );
  },
};

export default autoCloseDanglingTimersJob;
