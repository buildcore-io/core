import * as admin from 'firebase-admin';
import { merge } from 'lodash';

export function cOn(o: any): any {
  return uOn(merge(o, {
    createdOn: admin.firestore.Timestamp.now(),
  }));
};

export function uOn(o: any): any {
  return merge(o, {
    updatedOn: admin.firestore.Timestamp.now()
  })
};
