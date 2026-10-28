import { createReadStream, statSync } from 'fs';

import { DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { lookup } from 'mime-types';

import s3Client from '@/app/configs/s3Client.configs';
import { env } from '@/env';
import { unlinkFile } from '@/app/utils/system.utils';

const bucketName = env.S3_BUCKET_NAME;



export async function singleUploadToS3({
  filePath,
  key,
  mimeType,
}: {
  filePath: string;
  mimeType: string;
  key: string;
}): Promise<string> {
  try {
    const fileStats = statSync(filePath);
    const contentType = lookup(filePath);
    const stream = createReadStream(filePath);
    const command = new PutObjectCommand({
      Key: key,
      Bucket: bucketName,
      ContentType: contentType || `image/${mimeType.replace(/^\./, '')}`,
      Body: stream,
      ContentLength: fileStats.size,
      ACL: 'public-read',
    });
    await s3Client.send(command);
    stream.destroy();
    await unlinkFile({ filePath });
    return `${env.S3_PUBLIC_URL}/${key}`;
  } catch (error) {
    await unlinkFile({ filePath });
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred In S3 Single File Upload Utility');
  }
}

export async function singleDeleteToS3({ key }: { key: string }): Promise<void> {
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

export async function singleReadStreamFromS3({ key }: { key: string }) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    return response;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred In S3 Single File Read Utility');
  }
}

export async function getPresignedUrlFromS3({ key }: { key: string }): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    // URL expires in 30 minutes
    const signedUrl = await getSignedUrl(s3Client as any, command as any, { expiresIn: 1800 });
    return signedUrl;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Unknown Error Occurred While Presigning S3 URL');
  }
}
