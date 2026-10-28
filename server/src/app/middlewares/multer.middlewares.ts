import path from 'path';
import { AsyncResource } from 'async_hooks';

import { NextFunction, Request, Response } from 'express';
import multer, { diskStorage, FileFilterCallback, MulterError } from 'multer';

import { allowedAttachmentMimeTypes } from '@/const';
import { getTraceId } from '@/app/configs/requestContext.configs';

const storage = diskStorage({
  destination: (_req: Request, _file, cb) => {
    cb(null, './public/temp');
  },
  filename: (_req: Request, file, cb) => {
    const name = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    cb(null, name + '-' + Date.now() + '-' + ext);
  },
});

const allowedImageMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (allowedImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error('Only image files are allowed!'), {
        code: 'LIMIT_INVALID_IMAGE_TYPE',
      }) as any,
      false
    );
  }
};

export const docsUpload = multer({
  storage: storage,
});

// Base upload configuration
const baseUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // Global max limit
  fileFilter: imageFileFilter,
});

const attachmentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (
    (allowedAttachmentMimeTypes as readonly string[]).includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error('Invalid attachment type!'), {
        code: 'LIMIT_INVALID_ATTACHMENT_TYPE',
      }) as any,
      false
    );
  }
};

const attachmentBaseUpload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // Global max limit for attachments (e.g., 50MB)
  fileFilter: attachmentFileFilter,
});

// =====================================
// UPLOAD FIELDS MIDDLEWARE
// =====================================
export interface MulterFiles {
  [fieldname: string]: Express.Multer.File[];
}

export interface FieldConfig {
  name: string;
  maxCount: number;
  optional?: boolean;
}

/**
 * Reusable middleware for multiple file fields in ONE request.
 * All image fields are OPTIONAL by default — use this for both POST and PUT/PATCH.
 * Text-only requests (no files at all) are allowed unless requireAtLeastOneFile = true.
 *
 * @param fieldsConfig        - Array of { name, maxCount, optional } configurations.
 *                              Fields without optional:true are required ONLY when
 *                              requireAtLeastOneFile is false AND a file IS uploaded.
 * @param requireAtLeastOneFile - If true, at least one image must be present in the request.
 *                                Default: false (pure text-only requests pass through fine).
 *
 * @example
 * // Works for both create (POST) and update (PUT/PATCH) — images always optional
 * const productFields = [
 *   { name: 'thumbnail',    maxCount: 1  },
 *   { name: 'coverImages',  maxCount: 5  },
 *   { name: 'galleryImages',maxCount: 10 },
 * ];
 * router.post  ('/products',     uploadFields(productFields), handleMulterError, controller);
 * router.put   ('/products/:id', uploadFields(productFields), handleMulterError, controller);
 * router.patch ('/products/:id', uploadFields(productFields), handleMulterError, controller);
 */
export const uploadFields = (
  fieldsConfig: FieldConfig[],
  requireAtLeastOneFile: boolean = false
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Snapshot the current async context (e.g. AsyncLocalStorage-based trace
    // context) so it survives into multer's internal fs/stream callback.
    const asyncResource = new AsyncResource('uploadFields');

    // Store config for error handler
    req.fieldConfig = fieldsConfig;
    const traceId = getTraceId();
    const multerFields = fieldsConfig.map((field) => ({
      name: field.name,
      maxCount: field.maxCount,
    }));

    baseUpload.fields(multerFields)(
      req,
      res,
      asyncResource.bind((err: any) => {
        if (err) return next(err);

        const files = req.files as MulterFiles;
        const hasAnyFile = files && Object.keys(files).length > 0;

        // Only enforce "at least one file" if explicitly required
        if (requireAtLeastOneFile && !hasAnyFile) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: 'At least one file must be uploaded.',
            traceId,
          });
        }

        // No files uploaded → text-only request, always fine
        next();
      })
    );
  };
};

// ===========================================
// SINGLE / ARRAY HELPERS
// ===========================================

export const uploadArray = (
  fieldName: string,
  maxCount: number,
  required: boolean = false
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const asyncResource = new AsyncResource('uploadArray');

    req.fileLimit = maxCount;
    req.fieldName = fieldName;
    req.fileRequired = required;
    baseUpload.array(fieldName, maxCount)(
      req,
      res,
      asyncResource.bind((err: unknown) => {
        if (err) return next(err);

        const files = req.files as Express.Multer.File[] | undefined;
        const hasFiles = files && files.length > 0;

        if (required && !hasFiles) {
          return next(
            Object.assign(new Error(`'${fieldName}' file is required.`), {
              code: 'LIMIT_FILE_REQUIRED',
              field: fieldName,
            })
          );
        }
        next();
      })
    );
  };
};

export const uploadSingle = (fieldName: string, required: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const asyncResource = new AsyncResource('uploadSingle');

    req.fileLimit = 1;
    req.fieldName = fieldName;
    baseUpload.single(fieldName)(
      req,
      res,
      asyncResource.bind((err: unknown) => {
        if (err) return next(err);

        if (required && !req.file) {
          return next(
            Object.assign(new Error(`'${fieldName}' file is required.`), {
              code: 'LIMIT_FILE_REQUIRED',
              field: fieldName,
            })
          );
        }
        next();
      })
    );
  };
};

export const uploadAttachmentSingle = (
  fieldName: string,
  required: boolean = false
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const asyncResource = new AsyncResource('uploadAttachmentSingle');

    req.fileLimit = 1;
    req.fieldName = fieldName;
    attachmentBaseUpload.single(fieldName)(
      req,
      res,
      asyncResource.bind((err: unknown) => {
        if (err) return next(err);

        if (required && !req.file) {
          return next(
            Object.assign(new Error(`'${fieldName}' attachment is required.`), {
              code: 'LIMIT_FILE_REQUIRED',
              field: fieldName,
            })
          );
        }
        next();
      })
    );
  };
};

export const uploadAttachmentArray = (
  fieldName: string,
  maxCount: number,
  required: boolean = false
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const asyncResource = new AsyncResource('uploadAttachmentArray');

    req.fileLimit = maxCount;
    req.fieldName = fieldName;
    req.fileRequired = required;
    attachmentBaseUpload.array(fieldName, maxCount)(
      req,
      res,
      asyncResource.bind((err: unknown) => {
        if (err) return next(err);

        const files = req.files as Express.Multer.File[] | undefined;
        const hasFiles = files && files.length > 0;

        if (required && !hasFiles) {
          return next(
            Object.assign(
              new Error(`'${fieldName}' attachments are required.`),
              {
                code: 'LIMIT_FILE_REQUIRED',
                field: fieldName,
              }
            )
          );
        }
        next();
      })
    );
  };
};

// ================================================
// ERROR HANDLER
// ================================================
export const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const traceId = getTraceId();
  if (err instanceof MulterError) {
    const fileLimit = req.fileLimit || 10;
    const fieldName = req.fieldName || 'file';

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        status: 400,
        message: 'File size too large. Maximum allowed size is 5MB per file.',
        traceId,
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        status: 400,
        message: `Too many files. Maximum allowed is ${fileLimit} files.`,
        traceId,
      });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const allowedFields =
        req.fieldConfig?.map((f) => f.name).join(', ') || fieldName;
      res.status(400).json({
        success: false,
        status: 400,
        message: `Unexpected field '${err.field}'. Expected fields: ${allowedFields}.`,
        traceId,
      });
      return;
    }
    res.status(400).json({
      success: false,
      status: 400,
      message: err.message || 'File upload error.',
      traceId,
    });
    return;
  }
  // Handle required file missing error
  if (err?.code === 'LIMIT_FILE_REQUIRED') {
    res.status(400).json({
      success: false,
      status: 400,
      message: err.message,
      traceId,
    });
    return;
  }
  if (err?.code === 'LIMIT_INVALID_IMAGE_TYPE') {
    res.status(400).json({
      success: false,
      status: 400,
      message: err.message,
      traceId,
    });
    return;
  }

  next(err);
};

export const handleAttachmentMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const traceId = getTraceId();
  if (err instanceof MulterError) {
    const fileLimit = req.fileLimit || 10;
    const fieldName = req.fieldName || 'file';

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        status: 400,
        message:
          'Attachment size too large. Maximum allowed size is 50MB per file.',
        traceId,
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        status: 400,
        message: `Too many attachments. Maximum allowed is ${fileLimit}.`,
        traceId,
      });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const allowedFields =
        req.fieldConfig?.map((f) => f.name).join(', ') || fieldName;
      res.status(400).json({
        success: false,
        status: 400,
        message: `Unexpected field '${err.field}'. Expected fields: ${allowedFields}.`,
        traceId,
      });
      return;
    }
    res.status(400).json({
      success: false,
      status: 400,
      message: err.message || 'Attachment upload error.',
      traceId,
    });
    return;
  }

  if (
    err?.code === 'LIMIT_FILE_REQUIRED' ||
    err?.code === 'LIMIT_INVALID_ATTACHMENT_TYPE'
  ) {
    res.status(400).json({
      success: false,
      status: 400,
      message: err.message,
      traceId,
    });
    return;
  }

  next(err);
};
