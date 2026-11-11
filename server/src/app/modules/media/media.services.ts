import { singleDeleteToS3, singleUploadToS3 } from '@/app/utils/s3.utils';
import { extractS3KeyFromUrl } from '@/app/utils/system.utils';
import { v4 as uuidv4 } from 'uuid';
import {
  TRemoveMediaServiceParams,
  TUploadMediaServiceParams,
} from '@/app/modules/media/media.types';

export const uploadMediaService = async ({
  files,
}: TUploadMediaServiceParams): Promise<string[]> => {
  try {
    const uploadPromises = files.map(async (file) => {
      const extension = file.originalname.split('.').pop();
      const key = `attachments/${uuidv4()}-${Date.now()}.${extension}`;

      const url = await singleUploadToS3({
        filePath: file.path,
        key,
        mimeType: file.mimetype,
      });

      return url;
    });

    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    throw error;
  }
};

export const removeMediaService = async ({
  urls,
}: TRemoveMediaServiceParams): Promise<void> => {
  try {
    const keys = urls.map((url) => extractS3KeyFromUrl(url as string));
    await Promise.all(keys.map((key) => singleDeleteToS3({ key })));
    return;
  } catch (error) {
    throw error;
  }
};
