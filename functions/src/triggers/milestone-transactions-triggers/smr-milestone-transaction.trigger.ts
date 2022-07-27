import { CONFLICT_REASON_STRINGS, IBlockMetadata } from '@iota/iota.js-next';
import * as functions from 'firebase-functions';
import { Network } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { serverTime } from '../../utils/dateTime.utils';
import { milestoneTriggerConfig } from './common';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';

const handleMilestoneTransactionWrite = (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const data = (await transaction.get(change.after.ref)).data()!
    const adapter = new SmrMilestoneTransactionAdapter(network)
    const milestoneTransaction = await adapter.toMilestoneTransaction(change.after.id, data)
    if (milestoneTransaction.processed) {
      functions.logger.info('Nothing to process.');
      return;
    }

    const service = new ProcessingService(transaction);
    await service.processMilestoneTransactions(milestoneTransaction);
    service.submit();

    return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
  })
}

export const smrMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.SMR));

export const rmsMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.RMS));


const handleMilestoneTransactionConflictWrite = async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  const metadata = change.after.data() as IBlockMetadata
  const snap = await admin.firestore()
    .collection(COL.TRANSACTION)
    .where('payload.walletReference.chainReference', '==', metadata.blockId)
    .get()

  for (const doc of snap.docs) {
    doc.ref.update({
      'payload.walletReference.chainReference': null,
      'payload.walletReference.error': metadata.conflictReason ? CONFLICT_REASON_STRINGS[metadata.conflictReason] : null
    })
  }
}

export const smrMilestoneTransactionConflictWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS_CONFLICT}/{tranId}`)
  .onWrite(handleMilestoneTransactionConflictWrite);

export const rmsMilestoneTransactionConflictWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS_CONFLICT}/{tranId}`)
  .onWrite(handleMilestoneTransactionConflictWrite);
