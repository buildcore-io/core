/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  API_TIMEOUT_SECONDS,
  BaseRecord,
  COL,
  KeepAliveRequest,
  PING_INTERVAL,
  QUERY_MAX_LENGTH,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams } from './common';

import { Observable } from 'rxjs';
import { IDocument } from '../firebase/firestore/interfaces';

const keepAliveSchema = Joi.object({
  sessionIds: Joi.array().items(CommonJoi.sessionId()).min(1).max(QUERY_MAX_LENGTH).required(),
  close: Joi.array().items(Joi.boolean().optional()).max(QUERY_MAX_LENGTH).required(),
  // Temporary to be able to create unique signature.
  version: Joi.number().optional(),
});

export const keepAlive = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<KeepAliveRequest>(req, res, keepAliveSchema);
  if (!body) {
    return;
  }

  const batch = build5Db().batch();

  body.sessionIds.forEach((id, i) => {
    const docRef = build5Db().doc(`${COL.KEEP_ALIVE}/${id}`);
    body.close?.[i] ? batch.delete(docRef) : batch.set(docRef, {}, true);
  });

  await batch.commit();

  res.status(200).send({ update: true });
  return;
};

export const sendLiveUpdates = async <T>(res: express.Response, observable: Observable<T>) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const instanceIdDocRef = build5Db().collection(COL.KEEP_ALIVE).doc();
  await instanceIdDocRef.create({});
  res.write(`event: instance\ndata: ${instanceIdDocRef.getId()}\n\n`);

  const checkIsAlive = async () => {
    if (!(await isAlive(instanceIdDocRef))) {
      await closeConnection();
    }
  };
  const checkIsAliveInterval = setInterval(checkIsAlive, PING_INTERVAL);

  const instanceIdSub = instanceIdDocRef.onSnapshot((data) => {
    !data && closeConnection();
  });

  const timeout = setTimeout(() => {
    closeConnection();
  }, API_TIMEOUT_SECONDS * 1000 * 0.92);

  const subscription = observable.subscribe({
    next: (data) => {
      res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
    },
    error: (error) => {
      functions.logger.error(error);
      const data = { message: WenError.api_error.key };
      res.write(`event: error\ndata: ${JSON.stringify(data)}\n\n`);
      closeConnection();
    },
  });

  const closeConnection = async () => {
    res.write(`event: close\ndata: ${instanceIdDocRef.getId()}\n\n`);
    clearInterval(checkIsAliveInterval);
    clearTimeout(timeout);
    instanceIdSub();
    subscription.unsubscribe();
    await instanceIdDocRef.delete();
    res.end();
  };
};

const isAlive = async (docRef: IDocument) => {
  const doc = await docRef.get<BaseRecord>();
  const diff = dayjs().diff(dayjs(doc?.updatedOn?.toDate()));
  return doc !== undefined && diff < PING_INTERVAL;
};
