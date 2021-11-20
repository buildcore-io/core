import * as admin from 'firebase-admin';
import { merge } from 'lodash';

export function serverTime(): any {
  return admin.firestore.Timestamp.now();
}

export function cOn<T>(o: T): T {
  return uOn(merge(o, {
    createdOn: admin.firestore.Timestamp.now(),
  }));
};

export function uOn<T>(o: T): T {
  return merge(o, {
    updatedOn: admin.firestore.Timestamp.now()
  })
};

export function dateToTimestamp(d: Date): any {
  return admin.firestore.Timestamp.fromDate(new Date());
}
