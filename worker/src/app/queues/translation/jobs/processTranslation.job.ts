import { Job } from 'bullmq';
import crypto from 'crypto';
import { Prisma, TranslationStatus } from '@prisma/client';
import { IJobHandler } from '@/app/@types/queue.types';
import { IProcessTranslation } from '@/app/queues/translation/translation.types';
import { QUEUE_JOBS } from '@/const';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { translateTextsWithGoogle } from '@/app/services/translation/googleTranslate';
import { env } from '@/env';

/**
 * SHA-256 of eligible non-empty string fields (stable key order).
 *
 * @param {Record<string, string | null | undefined>} fields - Source fields.
 * @returns {string} Hex digest.
 */
const computeSourceHash = (
  fields: Record<string, string | null | undefined>
): string => {
  const sortedKeys = Object.keys(fields)
    .filter(
      (k) =>
        typeof fields[k] === 'string' && (fields[k] as string).trim().length > 0
    )
    .sort();
  const serialized = sortedKeys
    .map((key) => `${key}:${(fields[key] as string).trim()}`)
    .join('|');
  return crypto.createHash('sha256').update(serialized).digest('hex');
};

/**
 * Loads current source fields for a known content type (hash / existence checks).
 *
 * @param {string} contentType - Domain content type label.
 * @param {string} contentId - Entity UUID.
 * @returns {Promise<Record<string, string | null | undefined> | null>} Fields or null if missing.
 */
const fetchTargetEntityFields = async (
  contentType: string,
  contentId: string
): Promise<Record<string, string | null | undefined> | null> => {
  if (contentType === 'LEGAL_CONTENT') {
    const item = await prisma.legalContent.findUnique({
      where: { id: contentId },
      select: { content: true },
    });
    return item ? { content: item.content } : null;
  }
  if (contentType === 'NOTIFICATION') {
    const item = await prisma.notification.findUnique({
      where: { id: contentId },
      select: { title: true, message: true },
    });
    return item ? { title: item.title, message: item.message } : null;
  }
  if (contentType === 'PROJECT_NOTE') {
    const item = await prisma.projectNote.findUnique({
      where: { id: contentId },
      select: { content: true },
    });
    return item ? { content: item.content } : null;
  }
  if (contentType === 'PROJECT_TASK') {
    const item = await prisma.projectTask.findUnique({
      where: { id: contentId },
      select: { title: true, description: true },
    });
    return item ? { title: item.title, description: item.description } : null;
  }
  if (contentType === 'PROJECT') {
    const item = await prisma.project.findUnique({
      where: { id: contentId },
      select: { name: true, siteAccessNotes: true },
    });
    return item
      ? { name: item.name, siteAccessNotes: item.siteAccessNotes }
      : null;
  }
  if (contentType === 'CUSTOMER') {
    const item = await prisma.customer.findUnique({
      where: { id: contentId },
      select: { name: true },
    });
    return item ? { name: item.name } : null;
  }
  if (contentType === 'CUSTOMER_CONTACT') {
    const item = await prisma.customerContact.findUnique({
      where: { id: contentId },
      select: { name: true, role: true },
    });
    return item ? { name: item.name, role: item.role } : null;
  }
  if (contentType === 'INSPECTION') {
    const item = await prisma.inspection.findUnique({
      where: { id: contentId },
      select: {
        siteTitle: true,
        siteAccessInstructions: true,
        specialRequirements: true,
        scaffoldType: true,
      },
    });
    return item
      ? {
          siteTitle: item.siteTitle,
          siteAccessInstructions: item.siteAccessInstructions,
          specialRequirements: item.specialRequirements,
          scaffoldType: item.scaffoldType,
        }
      : null;
  }
  if (contentType === 'PROJECT_MEASUREMENT') {
    const item = await prisma.projectMeasurement.findUnique({
      where: { id: contentId },
      select: { position: true, remark: true, scaffoldType: true },
    });
    return item
      ? {
          position: item.position,
          remark: item.remark,
          scaffoldType: item.scaffoldType,
        }
      : null;
  }
  if (contentType === 'VEHICLE') {
    const item = await prisma.vehicle.findUnique({
      where: { id: contentId },
      select: { name: true },
    });
    return item ? { name: item.name } : null;
  }
  if (contentType === 'AUDIT_LOG') {
    const item = await prisma.auditLog.findUnique({
      where: { id: contentId },
      select: { details: true },
    });
    return item ? { details: item.details } : null;
  }
  if (contentType === 'USER') {
    const item = await prisma.user.findUnique({
      where: { id: contentId },
      select: { firstName: true, lastName: true },
    });
    return item ? { firstName: item.firstName, lastName: item.lastName } : null;
  }
  return null;
};

/**
 * Persists Google/mock translations into the Translation table (alua-compatible).
 */
const handler: IJobHandler<IProcessTranslation> = {
  name: QUEUE_JOBS.PROCESS_TRANSLATION,
  handler: async (data: IProcessTranslation, job: Job) => {
    const {
      contentType,
      contentId,
      sourceLocale,
      targetLocale,
      sourceHash,
      fields,
    } = data;

    try {
      const initialEntityFields = await fetchTargetEntityFields(
        contentType,
        contentId
      );

      if (!initialEntityFields) {
        logger.warn(
          `[processTranslation] Target entity ${contentType} ${contentId} no longer exists. Cleaning up translations and discarding job.`
        );
        await prisma.translation.deleteMany({
          where: { contentType, contentId },
        });
        return;
      }

      const requestedKeys = Object.keys(fields || {});
      const currentFiltered: Record<string, string> = {};
      for (const key of requestedKeys) {
        const val = initialEntityFields[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          currentFiltered[key] = val.trim();
        }
      }
      const currentHash = computeSourceHash(currentFiltered);
      if (currentHash !== sourceHash) {
        logger.warn(
          `[processTranslation] Source content has changed before execution (expected ${sourceHash}, got ${currentHash}). Discarding stale job.`
        );
        await prisma.translation.deleteMany({
          where: {
            contentType,
            contentId,
            targetLocale,
            sourceHash,
          },
        });
        return;
      }

      await prisma.translation.updateMany({
        where: {
          contentType,
          contentId,
          targetLocale,
          sourceHash,
          status: TranslationStatus.PENDING,
        },
        data: {
          status: TranslationStatus.PROCESSING,
        },
      });

      const entries = Object.entries(fields).filter(
        ([, value]) => typeof value === 'string' && value.trim().length > 0
      );

      let translatedFields: Record<string, string> = { ...fields };
      let providerName = (env.TRANSLATION_PROVIDER || 'mock').toLowerCase();

      if (entries.length > 0) {
        const translatedValues = await translateTextsWithGoogle(
          entries.map(([, value]) => value),
          sourceLocale,
          targetLocale
        );
        entries.forEach(([key], index) => {
          translatedFields[key] = translatedValues[index] ?? fields[key];
        });
        if (providerName !== 'google' || !env.GOOGLE_TRANSLATION_API_KEY) {
          providerName = 'passthrough';
        }
      }

      const postExecutionEntityFields = await fetchTargetEntityFields(
        contentType,
        contentId
      );

      if (!postExecutionEntityFields) {
        logger.warn(
          `[processTranslation] Target entity ${contentType} ${contentId} was deleted during provider execution. Cleaning up.`
        );
        await prisma.translation.deleteMany({
          where: { contentType, contentId },
        });
        return;
      }

      const postExecutionFiltered: Record<string, string> = {};
      for (const key of requestedKeys) {
        const val = postExecutionEntityFields[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          postExecutionFiltered[key] = val.trim();
        }
      }
      const postExecutionHash = computeSourceHash(postExecutionFiltered);
      if (postExecutionHash !== sourceHash) {
        logger.warn(
          `[processTranslation] Target entity updated during translation. Discarding stale result.`
        );
        await prisma.translation.deleteMany({
          where: {
            contentType,
            contentId,
            targetLocale,
            sourceHash,
          },
        });
        return;
      }

      const updateResult = await prisma.translation.updateMany({
        where: {
          contentType,
          contentId,
          targetLocale,
          sourceHash,
          status: TranslationStatus.PROCESSING,
        },
        data: {
          translatedFields: translatedFields as Prisma.InputJsonValue,
          status: TranslationStatus.READY,
          provider: providerName,
          errorMessage: null,
        },
      });

      if (updateResult.count === 0) {
        logger.warn(
          `[processTranslation] Record for ${contentType} ${contentId} (${sourceHash}) is no longer PROCESSING. Skip overwrite.`
        );
        return;
      }

      logger.info(
        `[processTranslation] Completed translation for ${contentType} ${contentId} (${sourceLocale} -> ${targetLocale}) using ${providerName}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[${job.name}] Translation job failed`, {
        jobId: job.id,
        contentType,
        contentId,
        error: message,
      });

      await prisma.translation.updateMany({
        where: {
          contentType,
          contentId,
          targetLocale,
          sourceHash,
          status: {
            in: [TranslationStatus.PROCESSING, TranslationStatus.PENDING],
          },
        },
        data: {
          status: TranslationStatus.FAILED,
          errorMessage: message,
        },
      });

      throw error;
    }
  },
};

export default handler;
