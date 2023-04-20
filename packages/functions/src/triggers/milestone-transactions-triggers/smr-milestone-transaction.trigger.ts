import { COL, Network, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { soonDb } from '../../firebase/firestore/soondb';
import { ProcessingService } from '../../services/payment/payment-processing';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';
import { confirmTransaction, milestoneTriggerConfig } from './common';
import { processConsumedVoteOutputs } from './consumed.vote.outputs';
import { updateTokenSupplyData } from './token.foundry';

const handleMilestoneTransactionWrite =
  (network: Network) =>
  async (
    change: functions.Change<functions.firestore.DocumentSnapshot>,
    context: functions.EventContext,
  ) => {
    if (!change.after.data()) {
      return;
    }
    try {
      return soonDb().runTransaction(async (transaction) => {
        const docRef = soonDb().doc(change.after.ref.path);
        const data = await transaction.get<Record<string, unknown>>(docRef);
        if (!data || data.processed) {
          return;
        }
        await confirmTransaction(change.after.ref.path, data, network);
        await updateTokenSupplyData(data);
        const adapter = new SmrMilestoneTransactionAdapter(network);
        const milestoneTransaction = await adapter.toMilestoneTransaction({
          ...data,
          uid: context.params.tranId,
        });
        const service = new ProcessingService(transaction);
        await service.processMilestoneTransactions(milestoneTransaction);
        service.submit();

        await processConsumedVoteOutputs(
          transaction,
          milestoneTransaction.inputs.map((i) => i.outputId!),
        );

        return transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
      });
    } catch (error) {
      functions.logger.error(`${network} transaction error`, change.after.ref.path, error);
    }
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
