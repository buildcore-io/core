import { COL, Network, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { soonDb } from '../../firebase/firestore/soondb';
import { ProcessingService } from '../../services/payment/payment-processing';
import { confirmTransaction, milestoneTriggerConfig } from './common';

const handleMilestoneTransactionWrite =
  (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    if (!change.after.data()) {
      return;
    }
    return soonDb().runTransaction(async (transaction) => {
      const docRef = soonDb().doc(change.after.ref.path);
      const milestoneTransaction = await transaction.get<Record<string, unknown>>(docRef);
      if (!milestoneTransaction || milestoneTransaction.processed) {
        return;
      }
      await confirmTransaction(change.after.ref.path, milestoneTransaction, network);

      const service = new ProcessingService(transaction);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.processMilestoneTransactions(milestoneTransaction as any);
      service.submit();

      transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
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
