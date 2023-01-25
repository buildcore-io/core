import {
  COL,
  generateRandomFileName,
  IMAGE_CACHE_AGE,
  IPFS_GATEWAY,
  WenError,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import admin from '../admin.config';
import { getBucket } from './config.utils';
import { getRandomEthAddress } from './wallet.utils';

export const migrateIpfsMediaToSotrage = async (
  col: COL,
  owner: string,
  uid: string,
  ipfsMedia: string,
) => {
  const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  try {
    fs.mkdirSync(workdir);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await fetch(`${IPFS_GATEWAY}${ipfsMedia}`);
    if (res.status !== 200) {
      throw WenError.ipfs_retrieve;
    }

    const size = res.headers.get('content-length');
    if (size > 100 * 1024 * 1024) {
      throw WenError.max_size;
    }
    const contentType = res.headers.get('content-type') || '';
    const extension = <string>mime.extension(contentType);
    const fileName = generateRandomFileName() + '.' + extension;

    const bucket = admin.storage().bucket(getBucket());

    const fileStream = fs.createWriteStream(path.join(workdir, fileName));
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    await bucket.upload(path.join(workdir, fileName), {
      destination: `${owner}/${uid}/${fileName}`,
      metadata: {
        contentType,
        cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
      },
    });

    return `https://${getBucket()}/${owner}/${uid}/${fileName}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    functions.logger.error(col, uid, error);
    throw error.code && error.key ? error : WenError.ipfs_retrieve;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};
