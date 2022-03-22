import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { COL, SUB_COL } from '../../interfaces/models/base';
import { superPump } from '../scale.settings';
import { ProcessingService } from '../services/payment/payment-processing';

// BIDDING flow
/*
 // Milestone confirm
  - once bid is confirmed it's counted for (has payment)
 - another bid can refund smaller bid.

 // Cron
 - finds NFT auction that should be closed but are still open
 - closes them and allocate winner
*/

// Listen for changes in all documents in the 'users' collection
export const milestoneTransactionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  minInstances: superPump,
}).firestore.document(COL.MILESTONE + '/{milestoneId}/' + SUB_COL.TRANSACTIONS + '/{tranId}').onWrite(async (change) => {
  const newValue: any = change.after.data();
  console.log('Milestone Transaction triggered');
  if (newValue && newValue?.processed !== true) {

    // We run everything completely inside of the transaction.
    await admin.firestore().runTransaction(async (transaction) => {
      const service: ProcessingService = new ProcessingService(transaction);
      await service.processMilestoneTransaction(newValue);

      // This will trigger all update/set.
      service.submit();
    });

    // Mark milestone as processed.
    return change.after.ref.set({
      processed: true,
      processedOn: admin.firestore.Timestamp.now()
    }, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});
