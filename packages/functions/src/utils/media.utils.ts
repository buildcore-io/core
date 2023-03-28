import {
  Bucket,
  COL,
  generateRandomFileName,
  IMAGE_CACHE_AGE,
  IPFS_GATEWAY,
  WenError,
} from '@soonaverse/interfaces';
import axios from 'axios';
import { randomUUID } from 'crypto';
import * as functions from 'firebase-functions';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import { IBucket } from '../firebase/storage/interfaces';

export const migrateUriToSotrage = async (
  col: COL,
  owner: string,
  uid: string,
  url: string,
  bucket: IBucket,
) => {
  const workdir = `${os.tmpdir()}/${randomUUID()}`;

  try {
    fs.mkdirSync(workdir);
    const { fileName, contentType } = await downloadMedia(workdir, url);
    const response = await bucket.upload(
      path.join(workdir, fileName),
      `${owner}/${uid}/${fileName}`,
      {
        contentType,
        cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
      },
    );

    if (bucket.getName() === Bucket.DEV) {
      return response;
    }
    return `https://${bucket.getName()}/${owner}/${uid}/${fileName}`;
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
        error = WenError.url_not_img_or_video;
        break;
      }
      const extension = <string>mime.extension(contentType);
      const fileName = generateRandomFileName() + '.' + extension;

      await downloadFile(url, workdir, fileName);
      return { fileName, contentType };
    } catch {
      error = WenError.ipfs_retrieve;
      continue;
    }
  }

  throw error;
};

export const uriToUrl = (uri: string) => {
  if (uri.startsWith('http')) {
    return uri;
  }
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${uri.replace('ipfs://', '')}`;
  }
  throw WenError.ipfs_retrieve;
};

export const downloadFile = async (url: string, workDir: string, fileName: string) => {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 120000,
  });

  response.data.pipe(fs.createWriteStream(path.join(workDir, fileName)));

  return new Promise<void>((resolve, reject) => {
    response.data.on('end', () => {
      resolve();
    });
    response.data.on('error', reject);
  });
};
