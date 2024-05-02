/* eslint-disable @typescript-eslint/no-explicit-any */
import { IBucket, storage } from '@buildcore/database';
import {
  Bucket,
  COL,
  IMAGE_CACHE_AGE,
  IPFS_GATEWAY,
  MAX_FILE_SIZE_BYTES,
  WenError,
  generateRandomFileName,
} from '@buildcore/interfaces';
import axios from 'axios';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import { BUCKET_BASE_URLS } from '../services/joi/common';
import { getBucket } from './config.utils';
import { logger } from './logger';

export const migrateUriToSotrage = async (
  col: COL,
  owner: string,
  uid: string,
  url: string,
  bucket: IBucket,
  allowAnyType = false,
) => {
  const workdir = `${os.tmpdir()}/${randomUUID()}`;

  try {
    fs.mkdirSync(workdir);
    const { fileName, contentType } = await downloadMedia(workdir, url, allowAnyType);
    const destination = `${owner}/${uid}/${fileName}`;
    const response = await bucket.upload(path.join(workdir, fileName), destination, {
      contentType,
      cacheControl: `public,max-age=${IMAGE_CACHE_AGE}`,
    });
    const buildcoreUrl =
      bucket.getName() === Bucket.DEV ? response : `https://${bucket.getName()}/${destination}`;
    return buildcoreUrl;
  } catch (error: any) {
    logger.error('migrateUriToSotrage - error', col, uid, error);
    throw error.code && error.key ? error : WenError.ipfs_retrieve;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

const downloadMedia = async (workdir: string, url: string, allowAnyType: boolean) => {
  let error = WenError.ipfs_retrieve;
  for (let i = 0; i < 5; ++i) {
    try {
      const head: any = await axios({ method: 'HEAD', url, timeout: 10000 });
      if (head.status !== 200) {
        error = WenError.ipfs_retrieve;
        continue;
      }

      const contentType = head.headers.get('content-type') || '';
      if (!allowAnyType && !contentType.startsWith('image') && !contentType.startsWith('video')) {
        error = WenError.url_not_img_or_video;
        break;
      }
      const extension = <string>mime.extension(contentType);
      const fileName = generateRandomFileName() + '.' + extension;

      const { size: bytes, hash } = await downloadFile(url, workdir, fileName);
      return { fileName, contentType, bytes, hash };
    } catch (err: any) {
      error = err.code === WenError.max_size.code ? err : WenError.ipfs_retrieve;
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

export const getRandomBuildcoreUrl = (owner: string, uid: string, extension: string) => {
  const bucket = storage().bucket(getBucket());
  const baseUrl = BUCKET_BASE_URLS[bucket.getName()];

  const isDev = bucket.getName() === Bucket.DEV;
  const destination = `${owner}/${uid}/${generateRandomFileName()}.${extension}`;
  const url = `${baseUrl}${isDev ? encodeURIComponent(destination) : destination}`;

  return isDev ? url + '?alt=media' : url;
};

export const downloadFile = async (url: string, workDir: string, fileName: string) => {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 120000,
  });

  if (response.headers['content-length'] > MAX_FILE_SIZE_BYTES) {
    throw WenError.max_size;
  }

  const destination = path.join(workDir, fileName);
  const stream = fs.createWriteStream(destination);
  response.data.pipe(stream);

  const contentType = response.headers['content-type'] || '';
  const extension = <string>mime.extension(contentType);

  return new Promise<{ extension: string; size: number; hash: string }>((resolve, reject) => {
    stream.on('finish', () => {
      const stats = fs.statSync(destination);
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        reject(WenError.max_size);
        return;
      }
      const content = fs.readFileSync(destination);
      resolve({
        extension,
        size: stats.size,
        hash: createHash('sha1')
          .update('' + content)
          .digest('hex'),
      });
    });

    stream.on('error', reject);
  });
};
