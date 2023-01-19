import { COL, Proposal, SUB_COL, Transaction, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin, { inc } from '../../admin.config';
import { serverTime, uOn } from '../../utils/dateTime.utils';

export const processConsumedVoteOutputs = async (
  transaction: admin.firestore.Transaction,
  consumedOutputIds: string[],
) => {
  for (const consumedOutput of consumedOutputIds) {
    const voteTransactionSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('payload.outputId', '==', consumedOutput)
      .where('payload.outputConsumed', '==', false)
      .limit(1)
      .get();
    if (!voteTransactionSnap.size) {
      continue;
    }

    const voteTransactionDocRef = voteTransactionSnap.docs[0].ref;
    const voteTransaction = voteTransactionSnap.docs[0].data() as Transaction;
    const proposalDocRef = admin
      .firestore()
      .doc(`${COL.PROPOSAL}/${voteTransaction.payload.proposalId}`);
    const proposal = <Proposal>(await proposalDocRef.get()).data();
    if (dayjs().isAfter(proposal.settings.endDate.toDate())) {
      transaction.update(voteTransactionDocRef, {
        'payload.outputConsumed': true,
        'payload.outputConsumedOn': serverTime(),
      });
      continue;
    }

    const prevWeight = voteTransaction.payload.weight;

    const currWeightMultiplier = getMultiplier(proposal, voteTransaction);
    const currWeight = voteTransaction.payload.tokenAmount * currWeightMultiplier;

    const value = voteTransaction.payload.values[0];
    const data = {
      results: {
        total: inc(-prevWeight + currWeight),
        voted: inc(-prevWeight + currWeight),
        answers: { [value]: inc(-prevWeight + currWeight) },
      },
    };
    transaction.set(proposalDocRef, uOn(data), { merge: true });

    transaction.update(voteTransactionDocRef, {
      'payload.weight': currWeight,
      'payload.weightMultiplier': currWeightMultiplier,
      'payload.outputConsumed': true,
      'payload.outputConsumedOn': serverTime(),
    });

    const proposalMemberDocRef = proposalDocRef
      .collection(SUB_COL.MEMBERS)
      .doc(voteTransaction.member!);
    transaction.set(
      proposalMemberDocRef,
      {
        values: admin.firestore.FieldValue.arrayRemove({
          [value]: prevWeight,
          voteTransaction: voteTransaction.uid,
        }),
        voteTransactions: inc(-1),
        weightPerAnswer: { [value]: inc(-prevWeight + currWeight) },
      },
      { merge: true },
    );
    transaction.update(proposalMemberDocRef, {
      values: admin.firestore.FieldValue.arrayUnion({
        [value]: currWeight,
        voteTransaction: voteTransaction.uid,
      }),
    });
  }
};

const getMultiplier = (proposal: Proposal, voteTransaction: Transaction) => {
  const startDate = dayjs(proposal.settings.startDate.toDate());
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const voteCreatedOn = dayjs(voteTransaction.createdOn?.toDate());
  const votedOn = voteCreatedOn.isBefore(startDate) ? startDate : voteCreatedOn;
  return dayjs().diff(votedOn) / endDate.diff(startDate);
};
