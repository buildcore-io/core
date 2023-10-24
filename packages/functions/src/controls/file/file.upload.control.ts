/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bucket, FileUploadRequest, WenError, generateRandomFileName } from '@build-5/interfaces';
import busboy from 'busboy';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import { build5Storage } from '@build-5/database';
import { getBucket } from '../../utils/config.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';
import { fileUploadSchema } from './FileUploadRequestSchema';

const MAX_FILE_SIZE_BYTES = 104857600; // 100 MB

export const uploadFileControl = async ({ headers, rawBody }: Context<FileUploadRequest>) => {
  const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  const params = await getParams(headers, rawBody, workdir);

  const { member, uid, ext } = params;
  await assertValidationAsync(fileUploadSchema, { member, uid });

  const destination = `${member}/${uid}/${generateRandomFileName()}.${ext}`;
  const bucketName = getBucket();
  const bucket = build5Storage().bucket(bucketName);
  const dowloadUrl = await bucket.upload(params.filePath as string, destination, {});

  fs.rmSync(workdir, { recursive: true, force: true });
  (params.file as any).resume();

  const idDevBucket = bucketName === Bucket.DEV;
  return { url: idDevBucket ? dowloadUrl : `https://${bucket.getName()}/${destination}` };
};

const getParams = (headers: any, rawBody: any, workdir: string) =>
  new Promise<Record<string, unknown>>((res, rej) => {
    const bb = busboy({ headers, limits: { fileSize: MAX_FILE_SIZE_BYTES } });
    const params: Record<string, unknown> = {};

    bb.on('file', (_, file, info) => {
      if (params.filePath) {
        file.resume();
        return;
      }

      fs.mkdirSync(workdir);
      const { filename, mimeType } = info;
      const filepath = path.join(workdir, filename);
      const writeStream = fs.createWriteStream(filepath);
      file.pipe(writeStream);

      params.filePath = filepath;
      params.mimeType = mimeType;
      params.ext = <string>mime.extension(mimeType);
      params.file = file;
    });

    bb.on('field', (name, val) => {
      params[name] = val;
    });

    bb.on('finish', async () => {
      if (!params.filePath) {
        rej(invalidArgument(WenError.invalid_params));
        return;
      }

      res(params);
    });

    bb.end(rawBody);
  });
