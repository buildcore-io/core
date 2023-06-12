import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { SmrMilestoneTransactionAdapter } from '../milestone-transactions-triggers/SmrMilestoneTransactionAdapter';

export const onProposalVoteCreditConfirmed = async (transaction: Transaction) => {
  const milestoneDoc = (await soonDb()
    .doc(transaction.payload.walletReference.milestoneTransactionPath)
    .get<Record<string, unknown>>())!;
  const adapter = new SmrMilestoneTransactionAdapter(transaction.network!);
  const milestoneTransaction = await adapter.toMilestoneTransaction(milestoneDoc);
  const outputId = milestoneTransaction.outputs[0].outputId!;
  const voteTransactionSnap = await soonDb()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.VOTE)
    .where('payload.creditId', '==', transaction.uid)
    .get<Transaction>();
  const voteTransactionDoc = soonDb().doc(`${COL.TRANSACTION}/${voteTransactionSnap[0].uid}`);
  await voteTransactionDoc.update({ 'payload.outputId': outputId });
};
