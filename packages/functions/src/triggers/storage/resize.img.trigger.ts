import { IMAGE_CACHE_AGE, WEN_FUNC_TRIGGER } from '@build-5/interfaces';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child-process-promise';
import * as functions from 'firebase-functions/v2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { IBucket } from '../../firebase/storage/interfaces';
import { soonStorage } from '../../firebase/storage/soonStorage';
import { scale } from '../../scale.settings';
import { getBucket } from '../../utils/config.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

export enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}

export const resizeImageTrigger = functions.storage.onObjectFinalized(
  {
    memory: '4GiB',
    minInstances: scale(WEN_FUNC_TRIGGER.resizeImg),
    bucket: getBucket(),
  },
  async (event) => {
    if (event.data.metadata?.resized) {
      return;
    }

    const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
    try {
      fs.mkdirSync(workdir);
      const downloadedMediaPath = await downloadMedia(workdir, event.data);
      if (event.data.contentType?.startsWith('image/')) {
        await uploadeResizedImages(workdir, event.data, downloadedMediaPath);
      } else {
        await uploadVideoPreview(workdir, event.data, downloadedMediaPath);
      }
    } catch (error) {
      functions.logger.error(error);
      throw error;
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  },
);

const downloadMedia = async (workdir: string, object: functions.storage.StorageObjectData) => {
  const destination = path.join(workdir, path.basename(object.name!));
  await soonStorage().bucket(object.bucket).download(object.name!, destination);
  return destination;
};

const uploadeResizedImages = async (
  workdir: string,
  object: functions.storage.StorageObjectData,
  downloadedImgPath: string,
) => {
  const extension = path.extname(downloadedImgPath);
  const fileName = path.basename(downloadedImgPath).replace(extension, '');
  const bucket = soonStorage().bucket(object.bucket);

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
  object: functions.storage.StorageObjectData,
  downloadedVideoPath: string,
) => {
  const extension = path.extname(downloadedVideoPath);
  const fileName = path.basename(downloadedVideoPath).replace(extension, '');
  const bucket = soonStorage().bucket(object.bucket);

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
