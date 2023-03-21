import { WEN_PROD_ADDRESS, WEN_TEST_ADDRESS } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isProdEnv } from '../../utils/config.utils';
import { IDocument } from './interfaces';

export const cOn = <T>(doc: IDocument, data: T) => {
  const url = isProdEnv() ? WEN_PROD_ADDRESS : WEN_TEST_ADDRESS;
  return {
    ...data,
    wenUrl: url + doc.getPath(),
    createdOn: dayjs().toDate(),
    updatedOn: dayjs().toDate(),
  };
};

export const uOn = <T>(data: T) => ({ ...data, updatedOn: dayjs().toDate() });
