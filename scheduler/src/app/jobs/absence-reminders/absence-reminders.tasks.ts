import { NotificationType } from '@prisma/client';
import { ICronJob } from '@/app/@types/job.types';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { triggerPushNotification } from '@/app/utils/notification.utils';

/**
 * Returns tomorrow's UTC day bounds derived from Europe/Berlin civil date.
 *
 * @returns {{ start: Date; endExclusive: Date; dateLabel: string }} Tomorrow window.
 */
const getBerlinTomorrowRange = (): {
  start: Date;
  endExclusive: Date;
  dateLabel: string;
} => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayParts = formatter.formatToParts(new Date());
  const year = Number(
    todayParts.find((p) => p.type === 'year')?.value ?? '1970'
  );
  const month = Number(
    todayParts.find((p) => p.type === 'month')?.value ?? '1'
  );
  const day = Number(todayParts.find((p) => p.type === 'day')?.value ?? '1');

  const tomorrowLocal = new Date(Date.UTC(year, month - 1, day + 1));
  const y = tomorrowLocal.getUTCFullYear();
  const m = String(tomorrowLocal.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tomorrowLocal.getUTCDate()).padStart(2, '0');
  const dateLabel = `${y}-${m}-${d}`;

  const start = new Date(`${dateLabel}T00:00:00.000Z`);
  const endExclusive = new Date(`${dateLabel}T23:59:59.999Z`);
  endExclusive.setUTCMilliseconds(endExclusive.getUTCMilliseconds() + 1);

  return { start, endExclusive, dateLabel };
};

/**
 * Evening reminders for absences overlapping tomorrow.
 */
const absenceRemindersJob: ICronJob = {
  name: 'absence-reminders',
  schedule: '0 18 * * *',
  execute: async () => {
    const { start, endExclusive, dateLabel } = getBerlinTomorrowRange();

    const absences = await prisma.absence.findMany({
      where: {
        startDate: { lt: endExclusive },
        endDate: { gte: start },
      },
      select: {
        id: true,
        userId: true,
        startDate: true,
      },
    });

    if (absences.length === 0) {
      logger.info('[absence-reminders] No absences overlapping tomorrow');
      return;
    }

    const byUser = new Map<string, Date>();
    for (const absence of absences) {
      const existing = byUser.get(absence.userId);
      if (!existing || absence.startDate < existing) {
        byUser.set(absence.userId, absence.startDate);
      }
    }

    for (const [userId, startDate] of byUser.entries()) {
      await triggerPushNotification(
        [userId],
        NotificationType.SYSTEM_ALERT,
        'notification.absence_reminder.title',
        'notification.absence_reminder.body',
        {
          date: startDate.toISOString().slice(0, 10) || dateLabel,
        }
      );
    }

    logger.info(
      `[absence-reminders] Dispatched ${byUser.size} reminders (${absences.length} absence rows)`
    );
  },
};

export default absenceRemindersJob;
