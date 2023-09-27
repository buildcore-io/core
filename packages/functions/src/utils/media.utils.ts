/* eslint-disable @typescript-eslint/no-explicit-any */
import { IBucket } from '@build-5/database';
import {
  Bucket,
  COL,
  generateRandomFileName,
  IMAGE_CACHE_AGE,
  IPFS_GATEWAY,
  MAX_FILE_SIZE_BYTES,
  WenError,
} from '@build-5/interfaces';
import axios from 'axios';
import crypto, { randomUUID } from 'crypto';
import * as functions from 'firebase-functions/v2';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';

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
    const build5Url =
      bucket.getName() === Bucket.DEV ? response : `https://${bucket.getName()}/${destination}`;
    return build5Url;
  } catch (error: any) {
    functions.logger.error(col, uid, error);
    throw error.code && error.key ? error : WenError.ipfs_retrieve;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

const downloadMedia = async (workdir: string, url: string, allowAnyType: boolean) => {
  let error = WenError.ipfs_retrieve;
  for (let i = 0; i < 5; ++i) {
    try {
      const head: any = await axios.head(url);
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

  return new Promise<{
    size: number;
    hash: string;
  }>((resolve, reject) => {
    let size = 0;
    const chunks: any = [];
    response.data.on('data', (chunk: any) => {
      chunks.push(chunk);
      size += chunk.length;
    });

    response.data.on('end', () => {
      if (size > MAX_FILE_SIZE_BYTES) {
        reject(WenError.max_size);
        return;
      }
      resolve({
        size,
        hash: crypto
          .createHash('sha1')
          .update('' + chunks.join())
          .digest('hex'),
      });
    });
    response.data.on('error', reject);
  });
};
