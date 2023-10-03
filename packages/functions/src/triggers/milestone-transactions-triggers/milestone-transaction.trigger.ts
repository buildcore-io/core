import { Network, SUB_COL, getMilestoneCol } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import { build5Db } from '../../firebase/firestore/build5Db';
import { ProcessingService } from '../../services/payment/payment-processing';
import { MilestoneTransactionAdapter } from './MilestoneTransactionAdapter';
import { confirmTransaction } from './common';
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
      return build5Db().runTransaction(async (transaction) => {
        const docRef = build5Db().doc(event.data!.after.ref.path);
        const data = await transaction.get<Record<string, unknown>>(docRef);
        if (!data || data.processed) {
          return;
        }
        await confirmTransaction(event.data!.after.ref.path, data);
        await updateTokenSupplyData(data);
        const adapter = new MilestoneTransactionAdapter(network);
        const milestoneTransaction = await adapter.toMilestoneTransaction({
          ...data,
          uid: event.params.tranId,
        });
        const service = new ProcessingService(transaction);
        await service.processMilestoneTransactions(milestoneTransaction);
        service.submit();

        await processConsumedVoteOutputs(transaction, milestoneTransaction.consumedOutputIds);

        return transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
      });
    } catch (error) {
      functions.logger.error(`${network} transaction error`, event.data!.after.ref.path, error);
    }
  };

const getDoc = (network: Network) =>
  `${getMilestoneCol(network)}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`;

const getHandler = (network: Network) =>
  functions.firestore.onDocumentWritten(
    { document: getDoc(network) },
    handleMilestoneTransactionWrite(network || Network.IOTA),
  );

export const smrMilestoneTransactionWrite = getHandler(Network.SMR);
export const rmsMilestoneTransactionWrite = getHandler(Network.RMS);
export const iotaMilestoneTransactionWrite = getHandler(Network.IOTA);
export const atoiMilestoneTransactionWrite = getHandler(Network.ATOI);
