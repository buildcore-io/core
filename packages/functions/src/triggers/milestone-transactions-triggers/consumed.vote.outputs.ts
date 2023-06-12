import { COL, Proposal, SUB_COL, Transaction, TransactionType } from '@build5/interfaces';
import dayjs from 'dayjs';
import { ITransaction } from '../../firebase/firestore/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getTokenVoteMultiplier } from '../../services/payment/voting-service';
import { serverTime } from '../../utils/dateTime.utils';

export const processConsumedVoteOutputs = async (
  transaction: ITransaction,
  consumedOutputIds: string[],
) => {
  for (const consumedOutput of consumedOutputIds) {
    const voteTransactionSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('payload.outputId', '==', consumedOutput)
      .where('payload.outputConsumed', '==', false)
      .limit(1)
      .get<Transaction>();
    if (!voteTransactionSnap.length) {
      continue;
    }

    const voteTransactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${voteTransactionSnap[0].uid}`);
    const voteTransaction = voteTransactionSnap[0];
    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${voteTransaction.payload.proposalId}`);
    const proposal = <Proposal>await proposalDocRef.get();
    if (dayjs().isAfter(proposal.settings.endDate.toDate())) {
      transaction.update(voteTransactionDocRef, {
        'payload.outputConsumed': true,
        'payload.outputConsumedOn': serverTime(),
      });
      continue;
    }

    const prevWeight = voteTransaction.payload.weight;

    const currWeightMultiplier = getTokenVoteMultiplier(
      proposal,
      dayjs(voteTransaction.createdOn?.toDate()),
      dayjs(),
    );
    const currWeight = voteTransaction.payload.tokenAmount * currWeightMultiplier;

    const value = voteTransaction.payload.values[0];
    const data = {
      results: {
        total: soonDb().inc(-prevWeight + currWeight),
        voted: soonDb().inc(-prevWeight + currWeight),
        answers: { [value]: soonDb().inc(-prevWeight + currWeight) },
      },
    };
    transaction.set(proposalDocRef, data, true);

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
        values: soonDb().arrayRemove({
          [value]: prevWeight,
          voteTransaction: voteTransaction.uid,
        }),
        voteTransactions: soonDb().inc(-1),
        weightPerAnswer: { [value]: soonDb().inc(-prevWeight + currWeight) },
      },
      true,
    );
    transaction.update(proposalMemberDocRef, {
      values: soonDb().arrayUnion({
        [value]: currWeight,
        voteTransaction: voteTransaction.uid,
      }),
    });
  }
};
