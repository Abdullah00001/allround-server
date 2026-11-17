import { TranslationStatus } from '@prisma/client';
import type { TranslationContentType } from '@/const';

export interface ITranslationProvider {
  name: string;
  translateText(
    text: string,
    sourceLocale: string,
    targetLocale: string
  ): Promise<string>;
  translateBatch(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>>;
}

export interface ITranslateContentParams {
  contentType: TranslationContentType | string;
  contentId: string;
  sourceLocale?: string;
  targetLocale?: string;
  fields: Record<string, string | null | undefined>;
  synchronous?: boolean;
}

export interface ITranslatedContentResult<T> {
  fields: T;
  displayedLocale: string;
  isTranslated: boolean;
  translationStatus: TranslationStatus;
}

export interface ITranslationJobPayload {
  contentType: string;
  contentId: string;
  sourceLocale: string;
  targetLocale: string;
  sourceHash: string;
  fields: Record<string, string>;
}

export interface ILocalizationMeta {
  sourceLocale: string;
  displayedLocale: string;
  isTranslated: boolean;
  translationStatus: TranslationStatus;
}
