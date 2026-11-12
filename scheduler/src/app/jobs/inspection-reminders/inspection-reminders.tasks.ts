import { InspectionStatus, NotificationType } from '@prisma/client';
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

  // Approximate Berlin midnight by using UTC midnight for the civil date label;
  // appointmentDate filters are date-oriented for reminders.
  const start = new Date(`${dateLabel}T00:00:00.000Z`);
  const endExclusive = new Date(`${dateLabel}T23:59:59.999Z`);
  endExclusive.setUTCMilliseconds(endExclusive.getUTCMilliseconds() + 1);

  return { start, endExclusive, dateLabel };
};

/**
 * Sends morning reminders for PENDING inspections scheduled tomorrow.
 */
const inspectionRemindersJob: ICronJob = {
  name: 'inspection-reminders',
  schedule: '0 8 * * *',
  execute: async () => {
    const { start, endExclusive, dateLabel } = getBerlinTomorrowRange();

    const inspections = await prisma.inspection.findMany({
      where: {
        deletedAt: null,
        status: InspectionStatus.PENDING,
        siteManagerId: { not: null },
        appointmentDate: {
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        id: true,
        siteTitle: true,
        siteManagerId: true,
      },
    });

    if (inspections.length === 0) {
      logger.info('[inspection-reminders] No inspections for tomorrow');
      return;
    }

    for (const inspection of inspections) {
      if (!inspection.siteManagerId) continue;
      await triggerPushNotification(
        [inspection.siteManagerId],
        NotificationType.INSPECTION_SCHEDULED,
        'notification.inspection_reminder.title',
        'notification.inspection_reminder.body',
        {
          siteTitle: inspection.siteTitle,
          date: dateLabel,
        }
      );
    }

    logger.info(
      `[inspection-reminders] Dispatched ${inspections.length} reminders`
    );
  },
};

export default inspectionRemindersJob;
