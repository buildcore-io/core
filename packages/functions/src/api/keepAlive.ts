/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRecord, COL, KeepAliveRequest, PING_INTERVAL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams } from './common';

import { Observable } from 'rxjs';

const keepAliveSchema = Joi.object({
  sessionId: CommonJoi.sessionId(),
});

export const keepAlive = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<KeepAliveRequest>(req, res, keepAliveSchema);
  if (!body) {
    return;
  }
  const docRef = soonDb().doc(`${COL.KEEP_ALIVE}/${body.sessionId}`);
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

  const keepAliveDocRef = soonDb().doc(`${COL.KEEP_ALIVE}/${sessionId}`);
  await keepAliveDocRef.set({}, true);

  const ping = async () => {
    const instance = await keepAliveDocRef.get<BaseRecord>();
    const diff = dayjs().diff(dayjs(instance?.updatedOn?.toDate()));
    if (!instance || diff > PING_INTERVAL) {
      await closeConnection();
    }
  };

  const pingInterval = setInterval(async () => {
    await ping();
  }, PING_INTERVAL);

  const subscription = observable.subscribe((data) => {
    res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
  });

  res.on('close', async () => {
    await closeConnection();
  });

  const closeConnection = async () => {
    subscription.unsubscribe();
    clearInterval(pingInterval);
    await keepAliveDocRef.delete();
    res.end();
  };
};
