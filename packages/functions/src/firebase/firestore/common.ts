import { SOON_PROD_ADDRESS, SOON_TEST_ADDRESS } from '@build5/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { isProdEnv } from '../../utils/config.utils';
import { IDocument } from './interfaces';

export const cOn = <T>(doc: IDocument, data: T) => {
  const url = isProdEnv() ? SOON_PROD_ADDRESS : SOON_TEST_ADDRESS;
  return {
    ...data,
    wenUrl: url + doc.getPath(),
    createdOn: get(data, 'createdOn') || dayjs().toDate(),
    updatedOn: get(data, 'updatedOn') || dayjs().toDate(),
  };
};

export const uOn = <T>(data: T) => ({ ...data, updatedOn: dayjs().toDate() });
