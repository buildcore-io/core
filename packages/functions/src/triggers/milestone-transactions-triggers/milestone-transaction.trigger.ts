import { build5Db } from '@build-5/database';
import { Network } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { ProcessingService } from '../../services/payment/payment-processing';
import { FirestoreDocEvent } from '../common';
import { MilestoneTransactionAdapter } from './MilestoneTransactionAdapter';
import { confirmTransaction } from './common';
import { processConsumedVoteOutputs } from './consumed.vote.outputs';
import { updateTokenSupplyData } from './token.foundry';
import { logger } from '../../utils/logger';

export const handleMilestoneTransactionWrite =
  (network: Network) => async (event: FirestoreDocEvent<Record<string, unknown>>) => {
    const { curr } = event;
    if (!curr) {
      return;
    }
    try {
      return build5Db().runTransaction(async (transaction) => {
        const docRef = build5Db().doc(event.path);
        const data = await transaction.get<Record<string, unknown>>(docRef);
        if (!data || data.processed) {
          return;
        }
        await confirmTransaction(event.path, data);
        await updateTokenSupplyData(data);
        const adapter = new MilestoneTransactionAdapter(network);
        const milestoneTransaction = await adapter.toMilestoneTransaction({
          ...data,
          uid: event.subDocId,
        });
        const service = new ProcessingService(transaction);
        await service.processMilestoneTransactions(milestoneTransaction);
        service.submit();

        await processConsumedVoteOutputs(milestoneTransaction.consumedOutputIds);

        return transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
      });
    } catch (error) {
      logger.error(`${network} transaction error`, event.path, error);
    }
  };
