import { build5Db } from '@build-5/database';
import { COL, Proposal, SUB_COL, Transaction, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getTokenVoteMultiplier } from '../../services/payment/voting-service';
import { serverTime } from '../../utils/dateTime.utils';

export const processConsumedVoteOutputs = async (consumedOutputIds: string[]) => {
  const batch = build5Db().batch();
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
      batch.update(voteTransactionDocRef, {
        'payload.outputConsumed': true,
        'payload.outputConsumedOn': serverTime(),
      });
      continue;
    }

    const prevWeight = voteTransaction.payload.weight!;

    const currWeightMultiplier = getTokenVoteMultiplier(
      proposal,
      dayjs(voteTransaction.createdOn?.toDate()),
      dayjs(),
    );
    const currWeight = voteTransaction.payload.tokenAmount! * currWeightMultiplier;

    const value = voteTransaction.payload.values![0];
    const data = {
      results: {
        total: build5Db().inc(-prevWeight + currWeight),
        voted: build5Db().inc(-prevWeight + currWeight),
        answers: { [value]: build5Db().inc(-prevWeight + currWeight) },
      },
    };
    batch.set(proposalDocRef, data, true);

    batch.update(voteTransactionDocRef, {
      'payload.weight': currWeight,
      'payload.weightMultiplier': currWeightMultiplier,
      'payload.outputConsumed': true,
      'payload.outputConsumedOn': serverTime(),
    });

    const proposalMemberDocRef = proposalDocRef
      .collection(SUB_COL.MEMBERS)
      .doc(voteTransaction.member!);
    batch.set(
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
    batch.update(proposalMemberDocRef, {
      values: build5Db().arrayUnion({
        [value]: currWeight,
        voteTransaction: voteTransaction.uid,
      }),
    });
  }
  await batch.commit();
};
