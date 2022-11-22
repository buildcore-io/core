import * as functions from 'firebase-functions';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import admin from '../../admin.config';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}

export const resizeImageTrigger = functions.storage
  .object()
  .onFinalize(async (object: functions.storage.ObjectMetadata) => {
    if (object.metadata?.resized) {
      return;
    }
    const downloadedImgPath = await downloadImg(object);
    await uploadeResizedImages(object, downloadedImgPath);
  });

const downloadImg = async (object: functions.storage.ObjectMetadata) => {
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
  const [fileName] = path.basename(downloadedImgPath).split('.');
  const workingDir = path.dirname(downloadedImgPath);
  const bucket = admin.storage().bucket(object.bucket);

  const uploadPromises = Object.values(ImageWidth).map(async (size) => {
    const resizedImgName = `${fileName}_${size}X${size}.webp`;
    const resizedImgLocalPath = path.join(workingDir, resizedImgName);
    const resizedImgStoragePath = path.join(path.dirname(object.name!), resizedImgName);

    await sharp(downloadedImgPath)
      .resize({ width: Number(size), height: Number(size) })
      .webp({ quality: 100 })
      .toFile(resizedImgLocalPath);

    await bucket.upload(resizedImgLocalPath, {
      destination: resizedImgStoragePath,
      metadata: {
        contentType: 'image/webp',
        cacheControl: `public,max-age=${imgCacheAge}`,
        metadata: {
          resized: 'true',
        },
      },
    });
  });

  await Promise.all(uploadPromises);
};

const imgCacheAge = 31536000; //  1 year in seconds
