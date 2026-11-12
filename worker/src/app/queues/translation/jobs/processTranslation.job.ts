import { Job } from 'bullmq';
import { IJobHandler } from '@/app/@types/queue.types';
import { IProcessTranslation } from '@/app/queues/translation/translation.types';
import { QUEUE_JOBS } from '@/const';
import logger from '@/app/configs/logger.configs';
import { translateTextsWithGoogle } from '@/app/services/translation/googleTranslate';

/**
 * Scaffolded translation worker: translates `fields` via Google Translate.
 * Persisting translated CRM content is intentionally out of scope for now.
 */
const handler: IJobHandler<IProcessTranslation> = {
  name: QUEUE_JOBS.PROCESS_TRANSLATION,
  handler: async (data: IProcessTranslation, job: Job) => {
    const { contentType, contentId, sourceLocale, targetLocale, fields } = data;

    try {
      const entries = Object.entries(fields).filter(
        ([, value]) => typeof value === 'string' && value.trim().length > 0
      );

      if (entries.length === 0) {
        logger.info(
          `[processTranslation] No fields to translate for ${contentType} ${contentId}`
        );
        return;
      }

      const translatedValues = await translateTextsWithGoogle(
        entries.map(([, value]) => value),
        sourceLocale,
        targetLocale
      );

      const translatedFields: Record<string, string> = {};
      entries.forEach(([key], index) => {
        translatedFields[key] = translatedValues[index] ?? fields[key];
      });

      logger.info(
        `[processTranslation] Translated ${contentType} ${contentId} (${sourceLocale} -> ${targetLocale})`,
        { fieldCount: entries.length, translatedFields }
      );
    } catch (error) {
      logger.error(`[${job.name}] Job failed`, { jobId: job.id, error });
      throw error;
    }
  },
};

export default handler;
