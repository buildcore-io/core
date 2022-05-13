import dayjs from 'dayjs';
import { merge } from 'lodash';
import { URL_PATHS, WEN_PROD_ADDRESS, WEN_TEST_ADDRESS } from '../../interfaces/config';
import { Timestamp } from '../../interfaces/models/base';
import admin from '../admin.config';
import { isProdEnv } from './config.utils';

export const serverTime = () => admin.firestore.Timestamp.now() as Timestamp;

export const uOn = <T>(o: T): T => merge(o, {
  updatedOn: serverTime()
})

export const cOn = <T extends { uid: string }>(o: T, path: URL_PATHS): T => {
  const url: string = isProdEnv ? WEN_PROD_ADDRESS : WEN_TEST_ADDRESS;
  return uOn(merge(o, {
    wenUrl: url + path + '/' + o.uid,
    createdOn: serverTime(),
  }));
};

export const dateToTimestamp = (d: dayjs.ConfigType, onlyDownToMinutes = false) => {
  const date = onlyDownToMinutes ? dayjs(d).second(0).millisecond(0) : dayjs(d);
  return admin.firestore.Timestamp.fromDate(date.toDate()) as Timestamp;
}
