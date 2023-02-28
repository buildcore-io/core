import { COL, GetAddressesRequest, MAX_MILLISECONDS, Network } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
import { dateToTimestamp } from '../utils/dateTime.utils';
import { getQueryParams } from './common';

const getAddressesSchema = Joi.object({
  network: Joi.string()
    .equal(...Object.values(Network))
    .required(),
  createdAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
});

export const getAddresses = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetAddressesRequest>(req, res, getAddressesSchema);
  if (!body) {
    return;
  }

  const query = admin
    .firestore()
    .collection(COL.MNEMONIC)
    .where('network', '==', body.network)
    .orderBy('createdOn')
    .startAfter(dateToTimestamp(dayjs(body.createdAfter)))
    .limit(1000);

  const snap = await query.get();
  const result = snap.docs.map((d) => ({
    createdOn: d.data()?.createdOn?.toDate(),
    addressBech32: d.id,
  }));

  res.send(result);
};
