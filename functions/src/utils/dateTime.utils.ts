import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { merge } from 'lodash';
import { URL_PATHS, WEN_PROD_ADDRESS, WEN_TEST_ADDRESS } from '../../interfaces/config';

export function serverTime(): any {
  return admin.firestore.Timestamp.now();
}

export function cOn<T>(o: T, path: URL_PATHS): T {
  let url: string = WEN_TEST_ADDRESS;
  if (functions.config()?.environment?.type === 'prod') {
    url = WEN_PROD_ADDRESS;
  }

  return uOn(merge(o, {
    wenUrl: url + path + '/' + (<any>o).uid,
    createdOn: admin.firestore.Timestamp.now(),
  }));
};

export function uOn<T>(o: T): T {
  return merge(o, {
    updatedOn: admin.firestore.Timestamp.now()
  })
};

export function dateToTimestamp(d: any, onlyDownToMinutes = false): any {
  let date = dayjs(d);
  if (onlyDownToMinutes) {
    date = date.second(0).millisecond(0);
  }

  return admin.firestore.Timestamp.fromDate(date.toDate());
}
