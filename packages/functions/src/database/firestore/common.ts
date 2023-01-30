import { COL, WEN_PROD_ADDRESS, WEN_TEST_ADDRESS } from '@soonaverse/interfaces';
import { get } from 'lodash';
import admin from '../../admin.config';
import { isProdEnv } from '../../utils/config.utils';

export const cOn = <T>(data: T, col: COL) => {
  const url = isProdEnv() ? WEN_PROD_ADDRESS : WEN_TEST_ADDRESS;
  return {
    ...data,
    wenUrl: url + col + '/' + get(data, 'uid', ''),
    createdOn: admin.firestore.FieldValue.serverTimestamp(),
    updatedOn: admin.firestore.FieldValue.serverTimestamp(),
  };
};

export const uOn = <T>(data: T) => ({
  ...data,
  updatedOn: admin.firestore.FieldValue.serverTimestamp(),
});
