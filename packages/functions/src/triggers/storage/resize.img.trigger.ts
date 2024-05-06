import { IBucket, storage } from '@buildcore/database';
import { IMAGE_CACHE_AGE, ImageWidth } from '@buildcore/interfaces';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child-process-promise';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../../utils/logger';
import { getRandomEthAddress } from '../../utils/wallet.utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

export interface StorageObject {
  metadata?: Record<string, unknown>;
  name: string;
  bucket: string;
  contentType?: string;
}

export const onStorageObjectFinalized = async (data: StorageObject) => {
  if (!data || data.metadata?.resized) {
    return;
  }

  const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  try {
    fs.mkdirSync(workdir);
    const downloadedMediaPath = await downloadMedia(workdir, data);
    if (data.contentType?.startsWith('image/')) {
      await uploadeResizedImages(workdir, data, downloadedMediaPath);
      return;
    }
    if (data.contentType?.startsWith('video/')) {
      await uploadVideoPreview(workdir, data, downloadedMediaPath);
      return;
    }
    logger.warn('Unsupported content type error', data);
  } catch (error) {
    logger.error('onStorageObjectFinalized-error', data, error);
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

const downloadMedia = async (workdir: string, object: StorageObject) => {
  const destination = path.join(workdir, path.basename(object.name!));
  await storage().bucket(object.bucket).download(object.name!, destination);
  return destination;
};

const uploadeResizedImages = async (
  workdir: string,
  object: StorageObject,
  downloadedImgPath: string,
) => {
  const extension = path.extname(downloadedImgPath);
  const fileName = path.basename(downloadedImgPath).replace(extension, '');
  const bucket = storage().bucket(object.bucket);

  const uploadPromises = Object.values(ImageWidth).map(async (size) => {
    const resizedImgName = `${fileName}_${extension.replace('.', '')}_${size}X${size}.webp`;
    const resizedImgLocalPath = path.join(workdir, resizedImgName);
    const resizedImgStoragePath = path.join(path.dirname(object.name!), resizedImgName);

    await createWebpImg(downloadedImgPath, resizedImgLocalPath, Number(size));
    await uploadResizedImg(bucket, resizedImgLocalPath, resizedImgStoragePath);
  });

  await Promise.all(uploadPromises);
};

const uploadVideoPreview = async (
  workdir: string,
  object: StorageObject,
  downloadedVideoPath: string,
) => {
  const extension = path.extname(downloadedVideoPath);
  const fileName = path.basename(downloadedVideoPath).replace(extension, '');
  const bucket = storage().bucket(object.bucket);

  const thumbnailName = `${fileName}.png`;
  const thumbnailLocalPath = path.join(workdir, thumbnailName);

  await createThumbnail(downloadedVideoPath, thumbnailLocalPath);

  const webpThumbnailName = `${fileName}_${extension.replace('.', '')}_preview.webp`;
  const webpThumbnailNameLocalPath = path.join(workdir, webpThumbnailName);
  await createWebpImg(thumbnailLocalPath, webpThumbnailNameLocalPath, Number(ImageWidth.tb));

  const thumbnailStoragePath = path.join(path.dirname(object.name!), webpThumbnailName);
  await uploadResizedImg(bucket, webpThumbnailNameLocalPath, thumbnailStoragePath);
};

const getVideoDuration = async (downloadedVideoPath: string) => {
  const durationProcesse = await spawn(
    ffprobePath,
    [
      '-i',
      downloadedVideoPath,
      '-v',
      'quiet',
      '-show_entries',
      'format=duration',
      '-hide_banner',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
    ],
    {
      capture: ['stdout'],
    },
  );
  return Number(durationProcesse.stdout);
};

const createThumbnail = async (downloadedVideoPath: string, thumbnailLocalPath: string) => {
  const duration = await getVideoDuration(downloadedVideoPath);
  const start = ((duration / 2) % 3.3333).toString();
  await spawn(ffmpegPath, [
    '-ss',
    start,
    '-i',
    downloadedVideoPath,
    '-vframes',
    '1',
    thumbnailLocalPath,
  ]);
};

const createWebpImg = (sourcePath: string, targetPath: string, width: number) =>
  sharp(sourcePath).resize({ width }).webp({ quality: 100 }).toFile(targetPath);

const uploadResizedImg = (bucket: IBucket, sourcePath: string, destination: string) =>
  bucket.upload(sourcePath, destination, {
    contentType: 'image/webp',
    cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
    metadata: {
      resized: 'true',
    },
  });
