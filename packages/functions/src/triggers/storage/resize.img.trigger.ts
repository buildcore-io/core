import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { Bucket } from '@google-cloud/storage';
import { spawn } from 'child-process-promise';
import * as functions from 'firebase-functions';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import admin from '../../admin.config';
import { getBucket } from '../../utils/config.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

export enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}

export const resizeImageTrigger = functions.storage
  .bucket(getBucket())
  .object()
  .onFinalize(async (object: functions.storage.ObjectMetadata) => {
    if (object.metadata?.resized) {
      return;
    }

    const downloadedMediaPath = await downloadMedia(object);
    if (object.contentType?.startsWith('image/')) {
      await uploadeResizedImages(object, downloadedMediaPath);
    } else {
      await uploadVideoPreview(object, downloadedMediaPath);
    }
    fs.rmSync(path.dirname(downloadedMediaPath), { recursive: true, force: true });
  });

const downloadMedia = async (object: functions.storage.ObjectMetadata) => {
  const tmpDir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  fs.mkdirSync(tmpDir);
  const destination = path.join(tmpDir, path.basename(object.name!));
  await admin.storage().bucket(object.bucket).file(object.name!).download({ destination });
  return destination;
};

const uploadeResizedImages = async (
  object: functions.storage.ObjectMetadata,
  downloadedImgPath: string,
) => {
  const extension = path.extname(downloadedImgPath);
  const fileName = path.basename(downloadedImgPath).replace(extension, '');
  const workingDir = path.dirname(downloadedImgPath);
  const bucket = admin.storage().bucket(object.bucket);

  const uploadPromises = Object.values(ImageWidth).map(async (size) => {
    const resizedImgName = `${fileName}_${extension.replace('.', '')}_${size}X${size}.webp`;
    const resizedImgLocalPath = path.join(workingDir, resizedImgName);
    const resizedImgStoragePath = path.join(path.dirname(object.name!), resizedImgName);

    await createWebpImg(downloadedImgPath, resizedImgLocalPath, Number(size));
    await uploadResizedImg(bucket, resizedImgLocalPath, resizedImgStoragePath);
  });

  await Promise.all(uploadPromises);
};

const imgCacheAge = 31536000; //  1 year in seconds

const uploadVideoPreview = async (
  object: functions.storage.ObjectMetadata,
  downloadedVideoPath: string,
) => {
  const extension = path.extname(downloadedVideoPath);
  const fileName = path.basename(downloadedVideoPath).replace(extension, '');
  const workingDir = path.dirname(downloadedVideoPath);
  const bucket = admin.storage().bucket(object.bucket);

  const thumbnailName = `${fileName}.png`;
  const thumbnailLocalPath = path.join(workingDir, thumbnailName);

  await createThumbnail(downloadedVideoPath, thumbnailLocalPath);

  const webpThumbnailName = `${fileName}_${extension.replace('.', '')}_preview.webp`;
  const webpThumbnailNameLocalPath = path.join(workingDir, webpThumbnailName);
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
  const start = Math.floor((duration / 2) % 3).toString();
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

const uploadResizedImg = (bucket: Bucket, sourcePath: string, destination: string) =>
  bucket.upload(sourcePath, {
    destination: destination,
    metadata: {
      contentType: 'image/webp',
      cacheControl: `public,max-age=${imgCacheAge}`,
      metadata: {
        resized: 'true',
      },
    },
  });
