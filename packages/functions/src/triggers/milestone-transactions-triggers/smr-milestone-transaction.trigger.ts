import { COL, Network, SUB_COL } from '@build5/interfaces';
import dayjs from 'dayjs';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import { soonDb } from '../../firebase/firestore/soondb';
import { ProcessingService } from '../../services/payment/payment-processing';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';
import { confirmTransaction, milestoneTriggerConfig } from './common';
import { processConsumedVoteOutputs } from './consumed.vote.outputs';
import { updateTokenSupplyData } from './token.foundry';

const handleMilestoneTransactionWrite =
  (network: Network) =>
  async (
    event: FirestoreEvent<
      functions.Change<DocumentSnapshot> | undefined,
      functions.ParamsOf<string>
    >,
  ) => {
    if (!event.data?.after?.data()) {
      return;
    }
    try {
      return soonDb().runTransaction(async (transaction) => {
        const docRef = soonDb().doc(event.data!.after.ref.path);
        const data = await transaction.get<Record<string, unknown>>(docRef);
        if (!data || data.processed) {
          return;
        }
        await confirmTransaction(event.data!.after.ref.path, data, network);
        await updateTokenSupplyData(data);
        const adapter = new SmrMilestoneTransactionAdapter(network);
        const milestoneTransaction = await adapter.toMilestoneTransaction({
          ...data,
          uid: event.params.tranId,
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
      functions.logger.error(`${network} transaction error`, event.data!.after.ref.path, error);
    }
  };

export const smrMilestoneTransactionWrite = functions.firestore.onDocumentWritten(
  {
    ...milestoneTriggerConfig,
    document: `${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  },
  handleMilestoneTransactionWrite(Network.SMR),
);

export const rmsMilestoneTransactionWrite = functions.firestore.onDocumentWritten(
  {
    ...milestoneTriggerConfig,
    document: `${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  },
  handleMilestoneTransactionWrite(Network.RMS),
);
