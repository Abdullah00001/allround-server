import { createReadStream, statSync } from 'fs';

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { lookup } from 'mime-types';

import s3Client from '@/app/configs/s3Client.configs';
import { env } from '@/env';
import { unlinkFile } from '@/app/utils/system.utils';

const bucketName = env.S3_BUCKET_NAME;

/**
 * Uploads a file to S3 and returns the public URL.
 * WHY: Abstracting this ensures consistent object metadata (ContentType, ACL).
 */
export async function singleUploadToS3({
  filePath,
  key,
  mimeType,
  acl = 'public-read',
}: {
  filePath: string;
  mimeType: string;
  key: string;
  acl?: 'public-read' | 'private';
}): Promise<string> {
  try {
    const fileStats = statSync(filePath);
    const contentType = lookup(filePath);
    const stream = createReadStream(filePath);
    const command = new PutObjectCommand({
      Key: key,
      Bucket: bucketName,
      ContentType: contentType || `application/${mimeType.replace(/^\./, '')}`,
      Body: stream,
      ContentLength: fileStats.size,
      ACL: acl,
    });
    await s3Client.send(command);
    stream.destroy();

    // Always cleanup the local temporary file
    await unlinkFile({ filePath });

    // Return the public URL following the repository's convention
    return `${env.S3_PUBLIC_URL}/${key}`;
  } catch (error) {
    await unlinkFile({ filePath });
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred In S3 Single File Upload Utility');
  }
}

/**
 * Deletes an object from S3.
 */
export async function singleDeleteToS3({
  key,
}: {
  key: string;
}): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred In S3 Single File Delete Utility');
  }
}
