import { build5Db } from '@build-5/database';
import { COL, Network, SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
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
      const docRef = build5Db().doc(event.data!.after.ref.path);
      const data = await docRef.get<Record<string, unknown>>();
      if (!data || data.processed) {
        return;
      }

      await confirmTransaction(event.data!.after.ref.path, data, network);
      await updateTokenSupplyData(data);

      const adapter = new SmrMilestoneTransactionAdapter(network);
      const milestone = await adapter.toMilestoneTransaction({ ...data, uid: event.params.tranId });
      const service = new ProcessingService();
      await service.processMilestoneTransactions(milestone);

      await processConsumedVoteOutputs(milestone.inputs.map((i) => i.outputId!));

      return docRef.update({ processed: true, processedOn: dayjs().toDate() });
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
