import { PgMilestoneTransactions, build5Db } from '@build-5/database';
import { COL, Network, SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { ProcessingService } from '../../services/payment/payment-processing';
import { logger } from '../../utils/logger';
import { PgDocEvent } from '../common';
import { MilestoneTransactionAdapter } from './MilestoneTransactionAdapter';
import { confirmTransaction } from './common';
import { processConsumedVoteOutputs } from './consumed.vote.outputs';
import { updateTokenSupplyData } from './token.foundry';

export const handleMilestoneTransactionWrite =
  // eslint-disable-next-line require-await
  (network: Network) => async (event: PgDocEvent<PgMilestoneTransactions>) => {
    const { curr } = event;
    if (!curr) {
      return;
    }
    const path = `${event.col}/${event.subColId}/${event.subCol!}/${event.uid}`;
    try {
      return build5Db().runTransaction(async (transaction) => {
        const docRef = build5Db().doc(
          event.col as COL.MILESTONE,
          event.subColId!,
          event.subCol! as SUB_COL.TRANSACTIONS,
          event.uid,
        );
        const milestoneTran = await transaction.get(docRef);
        if (!milestoneTran || milestoneTran.processed) {
          return;
        }
        await confirmTransaction(path, milestoneTran);
        await updateTokenSupplyData(milestoneTran);
        const adapter = new MilestoneTransactionAdapter(network);
        const milestoneTransaction = await adapter.toMilestoneTransaction(milestoneTran);
        const service = new ProcessingService(transaction);
        await service.processMilestoneTransactions(milestoneTransaction);
        await service.submit();

        await processConsumedVoteOutputs(milestoneTransaction.consumedOutputIds);

        return transaction.update(docRef, { processed: true, processedOn: dayjs().toDate() });
      });
    } catch (error) {
      logger.error(`${network} transaction error`, path, error);
      return;
    }
  };
