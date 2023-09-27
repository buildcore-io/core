import { build5Db } from '@build-5/database';
import { COL, Network, SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
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
      const docRef = build5Db().doc(event.data!.after.ref.path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const milestone = await docRef.get<any>();
      if (!milestone || milestone.processed) {
        return;
      }
      await confirmTransaction(event.data!.after.ref.path, milestone, network);

      const service = new ProcessingService();
      await service.processMilestoneTransactions(milestone);

      docRef.update({ processed: true, processedOn: dayjs().toDate() });
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
