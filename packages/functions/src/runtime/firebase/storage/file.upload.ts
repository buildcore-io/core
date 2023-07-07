import { Bucket, WEN_FUNC, WenError, generateRandomFileName } from '@build-5/interfaces';
import busboy from 'busboy';
import cors from 'cors';
import express from 'express';
import * as functions from 'firebase-functions/v2';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import { onRequestConfig } from '../../../firebase/functions/onRequest';
import { build5Storage } from '../../../firebase/storage/build5Storage';
import { getBucket } from '../../../utils/config.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { fileUploadSchema } from './FileUploadRequestSchema';

const MAX_FILE_SIZE_BYTES = 104857600; // 100 MB

export const uploadFile = functions.https.onRequest(
  onRequestConfig(WEN_FUNC.uploadFile, { memory: '256MiB' }),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      if (req.method !== 'POST') {
        sendBadRequest(res);
        return;
      }
      uploadFileControl(req, res);
    }),
);

export const uploadFileControl = (req: functions.https.Request, res: express.Response) => {
  const workdir = `${os.tmpdir()}/${getRandomEthAddress()}`;
  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE_BYTES } });
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
      sendBadRequest(res);
      return;
    }

    const { member, uid, ext, mimeType } = params;
    const areParamsCorrect = assertParams({ member, uid, mimeType }, res);
    if (!areParamsCorrect) {
      return;
    }

    const destination = `${member}/${uid}/${generateRandomFileName()}.${ext}`;
    const bucketName = getBucket();
    const bucket = build5Storage().bucket(bucketName);
    const dowloadUrl = await bucket.upload(params.filePath as string, destination, {});

    fs.rmSync(workdir, { recursive: true, force: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params.file as any).resume();

    const idDevBucket = bucketName === Bucket.DEV;
    const url = idDevBucket ? dowloadUrl : `https://${bucket.getName()}/${destination}`;
    res.status(200);
    res.send({ url });
  });

  bb.end(req.rawBody);
};

const sendBadRequest = (res: express.Response) => {
  res.status(400);
  res.send({ data: WenError.invalid_params });
};

const assertParams = (params: Record<string, unknown>, res: express.Response) => {
  const joiResult = fileUploadSchema.validate(params);
  if (joiResult.error) {
    res.status(400);
    res.send(joiResult.error.details.map((d) => d.message));
    return false;
  }
  return true;
};
