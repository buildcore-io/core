import { COL, Network, SUB_COL } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { uOn } from '../../utils/dateTime.utils';
import { confirmTransaction, milestoneTriggerConfig } from './common';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';
import { updateTokenSupplyData } from './token.foundry';

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
      await updateTokenSupplyData(doc);

      const adapter = new SmrMilestoneTransactionAdapter(network);
      const milestoneTransaction = await adapter.toMilestoneTransaction(doc);
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(milestoneTransaction);
      service.submit();

      return transaction.update(
        change.after.ref,
        uOn({ processed: true, processedOn: admin.firestore.FieldValue.serverTimestamp() }),
      );
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
