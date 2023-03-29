import {
  COL,
  GetAddressesRequest,
  MAX_MILLISECONDS,
  Mnemonic,
  Network,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { getQueryParams } from './common';

const getAddressesSchema = Joi.object({
  network: Joi.string()
    .equal(...Object.values(Network))
    .required(),
  createdAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
});

export const getAddresses = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetAddressesRequest>(req, res, getAddressesSchema);
  if (!body) {
    return;
  }

  const snap = await soonDb()
    .collection(COL.MNEMONIC)
    .where('network', '==', body.network)
    .orderBy('createdOn')
    .startAfter(dayjs(body.createdAfter).toDate())
    .limit(1000)
    .get<Mnemonic>();

  const result = snap.map((d) => ({
    createdOn: d.createdOn?.toDate(),
    addressBech32: get(d, 'uid'),
  }));

  res.send(result);
};
