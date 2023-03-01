import { Bucket as StorageBucket } from '@google-cloud/storage';
import {
  Bucket,
  COL,
  generateRandomFileName,
  IMAGE_CACHE_AGE,
  WenError,
} from '@soonaverse/interfaces';
import axios from 'axios';
import { randomUUID } from 'crypto';
import download from 'download';
import * as functions from 'firebase-functions';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';

export const migrateUriToSotrage = async (
  col: COL,
  owner: string,
  uid: string,
  url: string,
  bucket: StorageBucket,
) => {
  const workdir = `${os.tmpdir()}/${randomUUID()}`;

  try {
    fs.mkdirSync(workdir);
    const { fileName, contentType } = await downloadMedia(workdir, url);
    if (!fileName) {
      return '';
    }
    await bucket.upload(path.join(workdir, fileName), {
      destination: `${owner}/${uid}/${fileName}`,
      metadata: {
        contentType,
        cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
      },
    });

    if (bucket.name === Bucket.DEV) {
      return `http://localhost:4000/storage/${bucket.name}/${owner}/${uid}/${fileName}`;
    }
    return `https://${bucket.name}/${owner}/${uid}/${fileName}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    functions.logger.error(col, uid, error);
    throw error.code && error.key ? error : WenError.ipfs_retrieve;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

const downloadMedia = async (workdir: string, url: string) => {
  let error = WenError.ipfs_retrieve;
  for (let i = 0; i < 5; ++i) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const head: any = await axios.head(url);
      if (head.status !== 200) {
        error = WenError.ipfs_retrieve;
        continue;
      }
      const size = head.headers.get('content-length');
      if (size > 100 * 1024 * 1024) {
        error = WenError.max_size;
        break;
      }

      const contentType = head.headers.get('content-type') || '';
      if (!contentType.startsWith('image') && !contentType.startsWith('video')) {
        return { fileName: '', contentType: '' };
      }
      const extension = <string>mime.extension(contentType);
      const fileName = generateRandomFileName() + '.' + extension;

      await download(url, workdir, { filename: fileName });
      return { fileName, contentType };
    } catch {
      error = WenError.ipfs_retrieve;
      continue;
    }
  }

  throw error;
};
