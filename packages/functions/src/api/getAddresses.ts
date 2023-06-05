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
import { map } from 'rxjs';
import { soonDb } from '../firebase/firestore/soondb';
import { getQueryParams, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

const getAddressesSchema = Joi.object({
  network: Joi.string()
    .equal(...Object.values(Network))
    .required(),
  createdAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
  live: Joi.boolean().optional(),
});

export const getAddresses = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetAddressesRequest>(req, res, getAddressesSchema);
  if (!body) {
    return;
  }

  const query = soonDb()
    .collection(COL.MNEMONIC)
    .where('network', '==', body.network)
    .orderBy('createdOn')
    .startAfter(dayjs(body.createdAfter).toDate())
    .limit(1000);

  if (body.live) {
    const observable = queryToObservable<Mnemonic>(query).pipe(
      map((mnemonics) => mnemonics.map(sanitizeMnemonic)),
    );
    await sendLiveUpdates(res, observable);
    return;
  }

  const snap = await query.get<Mnemonic>();
  res.send(snap.map(sanitizeMnemonic));
};

const sanitizeMnemonic = (mnemonic: Mnemonic) => ({
  createdOn: mnemonic.createdOn?.toDate(),
  addressBech32: get(mnemonic, 'uid'),
});
