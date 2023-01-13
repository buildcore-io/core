import { COL, Transaction, TransactionType } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { uOn } from '../../utils/dateTime.utils';
import { SmrMilestoneTransactionAdapter } from '../milestone-transactions-triggers/SmrMilestoneTransactionAdapter';

export const onProposalVoteCreditConfirmed = async (transaction: Transaction) => {
  const milestoneDoc = await admin
    .firestore()
    .doc(transaction.payload.walletReference.milestoneTransactionPath)
    .get();
  const adapter = new SmrMilestoneTransactionAdapter(transaction.network!);
  const milestoneTransaction = await adapter.toMilestoneTransaction(milestoneDoc);
  const outputId = milestoneTransaction.outputs[0].outputId!;
  const voteTransactionSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.VOTE)
    .where('payload.creditId', '==', transaction.uid)
    .get();
  const voteTransactionDoc = voteTransactionSnap.docs[0];
  await voteTransactionDoc.ref.update(uOn({ 'payload.outputId': outputId }));
};
