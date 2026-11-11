import { Request, Response } from 'express';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import {
  uploadMediaService,
  removeMediaService,
} from '@/app/modules/media/media.services';
import { TDeleteMedia } from '@/app/modules/media/media.schema';

export const uploadMediaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const files = req.files as Express.Multer.File[];
    const data = await uploadMediaService({ files });
    res.status(200).json({
      success: true,
      message: 'Media uploads successful',
      data,
      traceId,
    });
    return;
  }
);

export const removeMediaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const { urls } = req.body as TDeleteMedia;
    await removeMediaService({ urls });

    res.status(200).json({
      success: true,
      message: 'Media items deletion successful!',
      traceId,
    });
    return;
  }
);
