import { Request, Response } from 'express';
import { LegalContentType } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  getAdminLegalContentService,
  getLegalContentService,
  updateLegalContentService,
} from '@/app/modules/legal/legal.services';
import { LegalContentDTO } from '@/app/modules/legal/legal.dto';
import { TUpdateLegalContentPayload } from '@/app/modules/legal/legal.types';
import { AuthErrorType } from '@/const';

/**
 * Handles `GET /legal/:type` (public).
 * Returns 404 when the document has not been published.
 *
 * @param {Request} req - Express request with validated `params.type`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getLegalContentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const type = req.params.type as LegalContentType;
    const data = await getLegalContentService({ type });

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Legal content not found.',
        errorType: AuthErrorType.LEGAL_CONTENT_NOT_FOUND,
        traceId,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Legal content fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/legal/:type`.
 * Returns empty content when unpublished so the editor can open blank.
 *
 * @param {Request} req - Express request with validated `params.type`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getAdminLegalContentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const type = req.params.type as LegalContentType;
    const data = await getAdminLegalContentService({ type });

    res.status(200).json({
      success: true,
      message: 'Legal content fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/legal/:type` (Publish).
 *
 * @param {Request} req - Express request with validated type + body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateLegalContentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const type = req.params.type as LegalContentType;
    const { content } = req.body as TUpdateLegalContentPayload;
    const row = await updateLegalContentService({ type, content });

    res.status(200).json({
      success: true,
      message: 'Legal content updated successfully.',
      data: LegalContentDTO.build(row),
      traceId,
    });
    return;
  }
);
