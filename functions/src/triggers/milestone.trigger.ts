import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { COL } from '../../interfaces/models/base';

// Listen for changes in all documents in the 'users' collection
export const milestoneWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.firestore.document(COL.MILESTONE + '/{milestoneId}').onWrite((change) => {
  const newValue: any = change.after.data();
  const previousValue: any = change.before.data();
  if ((!previousValue || previousValue.complete === false) && newValue.complete === true) {
    return change.after.ref.set({
      process: true
    }, {merge: true});
  } else {
    console.log('Nothing to do.');
  }
});
