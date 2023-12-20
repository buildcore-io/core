import { build5Db } from '@build-5/database';
import { COL, GetAddressesRequest, MAX_MILLISECONDS, Mnemonic, Network } from '@build-5/interfaces';
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

export const getAddresses = async (url: string) => {
  const body = getQueryParams<GetAddressesRequest>(url, getAddressesSchema);

  const query = build5Db()
    .collection(COL.MNEMONIC)
    .where('network', '==', body.network)
    .orderBy('createdOn')
    .startAfter(dayjs(body.createdAfter).toDate())
    .limit(1000);

  return queryToObservable<Mnemonic>(query).pipe(
    map((mnemonics) => mnemonics.map(sanitizeMnemonic)),
  );
};

const sanitizeMnemonic = (mnemonic: Mnemonic) => ({
  createdOn: mnemonic.createdOn?.toDate(),
  addressBech32: get(mnemonic, 'uid'),
});
