import { WEN_PROD_ADDRESS, WEN_TEST_ADDRESS } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { isProdEnv } from '../../utils/config.utils';
import { IDocument } from './interfaces';

export const cOn = <T>(doc: IDocument, data: T) => {
  const url = isProdEnv() ? WEN_PROD_ADDRESS : WEN_TEST_ADDRESS;
  return {
    ...data,
    wenUrl: url + doc.getPath(),
    createdOn: get(data, 'createdOn') || dayjs().toDate(),
    updatedOn: get(data, 'updatedOn') || dayjs().toDate(),
  };
};

export const uOn = <T>(data: T) => ({ ...data, updatedOn: dayjs().toDate() });
