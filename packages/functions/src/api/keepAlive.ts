/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRecord, COL, KeepAliveRequest } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { getQueryParams } from './common';

import { Observable } from 'rxjs';

const keepAliveSchema = Joi.object({
  instanceId: CommonJoi.uid(),
});

export const keepAlive = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<KeepAliveRequest>(req, res, keepAliveSchema);
  if (!body) {
    return;
  }
  const docRef = soonDb().doc(`${COL.KEEP_ALIVE}/${body.instanceId}`);
  await docRef.set({}, true);
  res.status(200).send({ update: true });
};

export const PING_INTERVAL = 30000;

export const sendLiveUpdates = async <T>(res: express.Response, observable: Observable<T>) => {
  const instanceId = getRandomEthAddress();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const keepAliveDocRef = soonDb().doc(`${COL.KEEP_ALIVE}/${instanceId}`);
  await keepAliveDocRef.create({});

  const ping = async () => {
    const instance = await keepAliveDocRef.get<BaseRecord>();
    if (!instance || dayjs().diff(dayjs(instance.updatedOn?.toDate())) > PING_INTERVAL) {
      await closeConnection();
      return;
    }
    res.write(`event: ping\ndata: ${instanceId}\n\n`);
  };

  const pingInterval = setInterval(async () => {
    await ping();
  }, PING_INTERVAL * 0.8);

  const subscription = observable.subscribe((data) => {
    res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
  });

  res.on('close', async () => {
    await closeConnection();
  });

  const closeConnection = async () => {
    await keepAliveDocRef.delete();
    clearInterval(pingInterval);
    subscription.unsubscribe();
    res.end();
  };
};
