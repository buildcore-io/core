/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRecord, COL, KeepAliveRequest, PING_INTERVAL } from '@build-5/interfaces';
import { randomUUID } from 'crypto';
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
  close: Joi.boolean().optional(),
});

export const keepAlive = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<KeepAliveRequest>(req, res, keepAliveSchema);
  if (!body) {
    return;
  }
  const docRef = build5Db().doc(`${COL.KEEP_ALIVE}/${body.sessionId}`);

  if (body.close) {
    await docRef.delete();
    res.status(200).send({ update: true });
    return;
  }

  await docRef.set({}, true);
  res.status(200).send({ update: true });
};

export const sendLiveUpdates = async <T>(
  sessionId: string,
  res: express.Response,
  observable: Observable<T>,
) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const instanceId = randomUUID().replace(/-/g, '');
  const instanceIdDocRef = build5Db().doc(`${COL.KEEP_ALIVE}/${instanceId}`);
  await instanceIdDocRef.create({});
  res.write(`event: instance\ndata: ${instanceId}\n\n`);

  const keepAliveDocRef = build5Db().doc(`${COL.KEEP_ALIVE}/${sessionId}`);
  await keepAliveDocRef.set({}, true);

  const ping = async () => {
    const instance = await keepAliveDocRef.get<BaseRecord>();
    const diff = dayjs().diff(dayjs(instance?.updatedOn?.toDate()));
    if (!instance || diff > PING_INTERVAL) {
      closeConnection();
    }
  };

  const pingInterval = setInterval(async () => {
    await ping();
  }, PING_INTERVAL);

  const instanceIdSub = instanceIdDocRef.onSnapshot((data) => {
    if (data === undefined) {
      closeConnection();
    }
  });

  const subscription = observable.subscribe((data) => {
    res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
  });

  const closeConnection = async () => {
    clearInterval(pingInterval);
    instanceIdSub();
    subscription.unsubscribe();
    await keepAliveDocRef.delete();
    await instanceIdDocRef.delete();
    res.end();
  };
};
