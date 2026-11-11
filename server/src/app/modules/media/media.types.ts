import { TDeleteMedia } from '@/app/modules/media/media.schema';

export type { TDeleteMedia };

export type TUploadMediaServiceParams = {
  files: Express.Multer.File[];
};

export type TRemoveMediaServiceParams = {
  urls: string[];
};
