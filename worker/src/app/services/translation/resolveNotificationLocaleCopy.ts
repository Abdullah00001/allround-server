import { TranslationStatus } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import logger from '@/app/configs/logger.configs';
import { translateTextsWithGoogle } from '@/app/services/translation/googleTranslate';

export type TLocalizedNotificationCopy = {
  title: string;
  body: string;
  locale: string;
};

/**
 * Resolves title/body for a target locale: READY Translation row first, else
 * Google Translate with auto-detect (omits source so EN or DE copy both work).
 *
 * @param {object} params - Notification id + source copy + target locale.
 * @returns {Promise<TLocalizedNotificationCopy>} Localized copy.
 */
export const resolveNotificationLocaleCopy = async ({
  notificationId,
  title,
  body,
  targetLocale,
  sourceLocale,
}: {
  notificationId: string;
  title: string;
  body: string;
  targetLocale: string;
  sourceLocale: string;
}): Promise<TLocalizedNotificationCopy> => {
  const locale = targetLocale.toLowerCase().slice(0, 2);
  const source = sourceLocale.toLowerCase().slice(0, 2);

  if (locale === source) {
    return { title, body, locale };
  }

  const ready = await prisma.translation.findFirst({
    where: {
      contentType: 'NOTIFICATION',
      contentId: notificationId,
      targetLocale: locale,
      status: TranslationStatus.READY,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (ready?.translatedFields && typeof ready.translatedFields === 'object') {
    const fields = ready.translatedFields as Record<string, string>;
    return {
      title: fields.title ?? title,
      body: fields.message ?? body,
      locale,
    };
  }

  try {
    const [translatedTitle, translatedBody] = await translateTextsWithGoogle(
      [title, body],
      'auto',
      locale
    );
    return {
      title: translatedTitle || title,
      body: translatedBody || body,
      locale,
    };
  } catch (error) {
    logger.error(
      `[resolveNotificationLocaleCopy] Translate failed ${notificationId} → ${locale}`,
      { error }
    );
    return { title, body, locale: source };
  }
};
