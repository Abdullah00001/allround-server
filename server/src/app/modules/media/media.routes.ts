import { Router } from 'express';
import {
  uploadMediaController,
  removeMediaController,
} from '@/app/modules/media/media.controllers';
import {
  handleAttachmentMulterError,
  uploadAttachmentArray,
} from '@/app/middlewares/multer.middlewares';
import { validateReqBody } from '@/app/utils/system.utils';
import { deleteMediaSchema } from '@/app/modules/media/media.schema';

const router = Router();

router
  .route('/media')
  .post(
    uploadAttachmentArray('files', 10, true),
    handleAttachmentMulterError,
    uploadMediaController
  );

router
  .route('/media')
  .delete(validateReqBody(deleteMediaSchema), removeMediaController);

export default router;
