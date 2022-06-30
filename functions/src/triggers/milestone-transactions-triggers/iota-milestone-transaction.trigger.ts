import * as functions from 'firebase-functions';
import { Network } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { MilestoneTransaction } from '../../../interfaces/models/milestone';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { serverTime } from '../../utils/dateTime.utils';
import { milestoneTriggerConfig } from './common';

const handleMilestoneTransactionWrite = () => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(change.after.ref)
    const milestoneTransaction = <MilestoneTransaction>snapshot.data()
    if (!milestoneTransaction.processed) {
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(milestoneTransaction);
      service.submit();
      return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
    } else {
      functions.logger.info('Nothing to process.');
      return;
    }
  })
}

export const iotaMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite());

export const atoiMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.ATOI}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite());
