import { COL, MilestoneTransaction, Network, SUB_COL } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { serverTime, uOn } from '../../utils/dateTime.utils';
import { confirmTransaction, milestoneTriggerConfig } from './common';

const handleMilestoneTransactionWrite =
  (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    if (!change.after.data()) {
      return;
    }
    return admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(change.after.ref);
      const milestoneTransaction = doc.data();
      if (!milestoneTransaction || milestoneTransaction.processed) {
        return;
      }
      await confirmTransaction(doc, network);

      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(milestoneTransaction as MilestoneTransaction);
      service.submit();

      transaction.update(change.after.ref, uOn({ processed: true, processedOn: serverTime() }));
    });
  };

export const iotaMilestoneTransactionWrite = functions
  .runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.IOTA));

export const atoiMilestoneTransactionWrite = functions
  .runWith(milestoneTriggerConfig)
  .firestore.document(
    `${COL.MILESTONE}_${Network.ATOI}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  )
  .onWrite(handleMilestoneTransactionWrite(Network.ATOI));
