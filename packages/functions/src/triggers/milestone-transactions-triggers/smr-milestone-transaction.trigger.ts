import { COL, Network, SUB_COL } from '@soon/interfaces';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { serverTime } from '../../utils/dateTime.utils';
import { confirmTransaction, milestoneTriggerConfig } from './common';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';

const handleMilestoneTransactionWrite =
  (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    if (!change.after.data()) {
      return;
    }
    return admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(change.after.ref);
      const data = doc.data();
      if (!data || data.processed) {
        return;
      }
      await confirmTransaction(doc, network);

      const adapter = new SmrMilestoneTransactionAdapter(network);
      const milestoneTransaction = await adapter.toMilestoneTransaction(doc);
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(milestoneTransaction);
      service.submit();

      return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() });
    });
  };

export const smrMilestoneTransactionWrite = functions
  .runWith(milestoneTriggerConfig)
  .firestore.document(
    `${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  )
  .onWrite(handleMilestoneTransactionWrite(Network.SMR));

export const rmsMilestoneTransactionWrite = functions
  .runWith(milestoneTriggerConfig)
  .firestore.document(
    `${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  )
  .onWrite(handleMilestoneTransactionWrite(Network.RMS));
