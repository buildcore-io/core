import { COL, Network, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import { soonDb } from '../../firebase/firestore/soondb';
import { ProcessingService } from '../../services/payment/payment-processing';
import { confirmTransaction, milestoneTriggerConfig } from './common';

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
        const milestoneTransaction = await transaction.get<Record<string, unknown>>(docRef);
        if (!milestoneTransaction || milestoneTransaction.processed) {
          return;
        }
        await confirmTransaction(event.data!.after.ref.path, milestoneTransaction, network);

        const service = new ProcessingService(transaction);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await service.processMilestoneTransactions(milestoneTransaction as any);
        service.submit();

        transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
      });
    } catch (error) {
      functions.logger.error(`${network} transaction error`, event.data!.after.ref.path, error);
    }
  };

export const iotaMilestoneTransactionWrite = functions.firestore.onDocumentWritten(
  {
    ...milestoneTriggerConfig,
    document: `${COL.MILESTONE}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  },
  handleMilestoneTransactionWrite(Network.IOTA),
);

export const atoiMilestoneTransactionWrite = functions.firestore.onDocumentWritten(
  {
    ...milestoneTriggerConfig,
    document: `${COL.MILESTONE}_${Network.ATOI}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`,
  },
  handleMilestoneTransactionWrite(Network.ATOI),
);
