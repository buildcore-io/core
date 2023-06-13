import { COL, Proposal, SUB_COL, Transaction, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { ITransaction } from '../../firebase/firestore/interfaces';
import { getTokenVoteMultiplier } from '../../services/payment/voting-service';
import { serverTime } from '../../utils/dateTime.utils';

export const processConsumedVoteOutputs = async (
  transaction: ITransaction,
  consumedOutputIds: string[],
) => {
  for (const consumedOutput of consumedOutputIds) {
    const voteTransactionSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('payload.outputId', '==', consumedOutput)
      .where('payload.outputConsumed', '==', false)
      .limit(1)
      .get<Transaction>();
    if (!voteTransactionSnap.length) {
      continue;
    }

    const voteTransactionDocRef = build5Db().doc(
      `${COL.TRANSACTION}/${voteTransactionSnap[0].uid}`,
    );
    const voteTransaction = voteTransactionSnap[0];
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${voteTransaction.payload.proposalId}`);
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
        total: build5Db().inc(-prevWeight + currWeight),
        voted: build5Db().inc(-prevWeight + currWeight),
        answers: { [value]: build5Db().inc(-prevWeight + currWeight) },
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
        values: build5Db().arrayRemove({
          [value]: prevWeight,
          voteTransaction: voteTransaction.uid,
        }),
        voteTransactions: build5Db().inc(-1),
        weightPerAnswer: { [value]: build5Db().inc(-prevWeight + currWeight) },
      },
      true,
    );
    transaction.update(proposalMemberDocRef, {
      values: build5Db().arrayUnion({
        [value]: currWeight,
        voteTransaction: voteTransaction.uid,
      }),
    });
  }
};
