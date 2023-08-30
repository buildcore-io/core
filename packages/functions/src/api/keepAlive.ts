/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  API_TIMEOUT_SECONDS,
  COL,
  KeepAliveRequest,
  PING_INTERVAL,
  QUERY_MAX_LENGTH,
  Timestamp,
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

const keepAliveSchema = Joi.object({
  sessionId: CommonJoi.sessionId(),
  instanceIds: Joi.array().items(CommonJoi.sessionId()).min(1).max(QUERY_MAX_LENGTH).required(),
  version: Joi.number().optional(),
});

export const keepAlive = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<KeepAliveRequest>(req, res, keepAliveSchema);
  if (!body) {
    return;
  }

  const now = dayjs().toDate();
  const data = body.instanceIds.reduce((acc, act) => ({ ...acc, [act]: now }), {});
  await build5Db().doc(`${COL.KEEP_ALIVE}/${body.sessionId}`).set(data, true);

  res.status(200).send({ update: true });
  return;
};

export const sendLiveUpdates = async <T>(
  sessionId: string,
  res: express.Response,
  observable: Observable<T>,
) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const instanceId = build5Db().collection(COL.KEEP_ALIVE).doc().getId();
  const sessionDocRef = build5Db().doc(`${COL.KEEP_ALIVE}/${sessionId}`);
  await sessionDocRef.set({ [instanceId]: dayjs().toDate() }, true);

  res.write(`event: instance\ndata: ${instanceId}\n\n`);

  const checkIsAlive = async () => {
    if (!(await isAlive(sessionId, instanceId))) {
      await closeConnection();
    }
  };
  const checkIsAliveInterval = setInterval(checkIsAlive, PING_INTERVAL);

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
    res.write(`event: close\ndata: ${instanceId}\n\n`);
    clearInterval(checkIsAliveInterval);
    clearTimeout(timeout);
    subscription.unsubscribe();
    res.end();
  };
};

const isAlive = async (sessionId: string, instanceId: string) => {
  const doc = await build5Db()
    .doc(`${COL.KEEP_ALIVE}/${sessionId}`)
    .get<Record<string, Timestamp>>();
  const diff = dayjs().diff(dayjs(doc?.[instanceId]?.toDate()));
  return doc?.[instanceId] && diff < PING_INTERVAL;
};
