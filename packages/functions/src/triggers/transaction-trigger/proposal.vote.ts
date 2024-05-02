import { PgTransaction, build5Db } from '@build-5/database';
import { COL, Network, TransactionType } from '@build-5/interfaces';
import { getPathParts } from '../../utils/milestone';
import { MilestoneTransactionAdapter } from '../milestone-transactions-triggers/MilestoneTransactionAdapter';

export const onProposalVoteCreditConfirmed = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestone = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  const network = (transaction.network as Network)!;
  const adapter = new MilestoneTransactionAdapter(network);
  const milestoneTransaction = await adapter.toMilestoneTransaction(milestone);
  const outputId = milestoneTransaction.outputs[0].outputId!;
  const voteTransactionSnap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.VOTE)
    .where('payload_creditId', '==', transaction.uid)
    .get();
  const voteTransactionDoc = build5Db().doc(COL.TRANSACTION, voteTransactionSnap[0].uid);
  await voteTransactionDoc.update({ payload_outputId: outputId });
};
