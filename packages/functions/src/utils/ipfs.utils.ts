import {
  Bucket,
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
  const bucket = getBucket();
  const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  try {
    fs.mkdirSync(workdir);
    const { fileName, contentType } = await downloadIpfsMedia(workdir, ipfsMedia);
    await admin
      .storage()
      .bucket(bucket)
      .upload(path.join(workdir, fileName), {
        destination: `${owner}/${uid}/${fileName}`,
        metadata: {
          contentType,
          cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
        },
      });

    if (bucket === Bucket.DEV) {
      return `http://localhost:4000/storage/${bucket}/${owner}/${uid}/${fileName}`;
    }
    return `https://${bucket}/${owner}/${uid}/${fileName}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    functions.logger.error(col, uid, error);
    throw error.code && error.key ? error : WenError.ipfs_retrieve;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

const downloadIpfsMedia = async (workdir: string, ipfsMedia: string) => {
  let error = WenError.ipfs_retrieve;
  for (let i = 0; i < 5; ++i) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const head: any = await fetch(`${IPFS_GATEWAY}${ipfsMedia}`, { method: 'head' });
    if (head.status !== 200) {
      error = WenError.ipfs_retrieve;
      continue;
    }
    const size = head.headers.get('content-length');
    if (size > 100 * 1024 * 1024) {
      error = WenError.max_size;
      break;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await fetch(`${IPFS_GATEWAY}${ipfsMedia}`);
    if (res.status !== 200) {
      error = WenError.ipfs_retrieve;
      continue;
    }

    const contentType = res.headers.get('content-type') || '';
    const extension = <string>mime.extension(contentType);
    const fileName = generateRandomFileName() + '.' + extension;

    const fileStream = fs.createWriteStream(path.join(workdir, fileName));
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    return { fileName, contentType };
  }

  throw error;
};
