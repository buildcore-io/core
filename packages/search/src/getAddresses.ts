import { database } from '@buildcore/database';
import {
  COL,
  GetAddressesRequest,
  MAX_MILLISECONDS,
  Mnemonic,
  Network,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { get } from 'lodash';
import { map } from 'rxjs';
import { getQueryParams, queryToObservable } from './common';

const getAddressesSchema = Joi.object({
  network: Joi.string()
    .equal(...Object.values(Network))
    .required(),
  createdAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
});

export const getAddresses = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetAddressesRequest>(url, getAddressesSchema);

  const query = database()
    .collection(COL.MNEMONIC)
    .where('network', '==', body.network)
    .where('createdOn', '>', dayjs.unix(body.createdAfter).toDate())
    .orderBy('createdOn')
    .limit(1000);

  return queryToObservable(query, isLive).pipe(map((mnemonics) => mnemonics.map(sanitizeMnemonic)));
};

const sanitizeMnemonic = (mnemonic: Mnemonic) => ({
  createdOn: mnemonic.createdOn?.toDate(),
  addressBech32: get(mnemonic, 'uid'),
});
