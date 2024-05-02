import { PgProposalUpdate, build5Db } from '@build-5/database';
import { COL, Proposal, SUB_COL, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getTokenVoteMultiplier } from '../../services/payment/voting-service';

export const processConsumedVoteOutputs = async (consumedOutputIds: string[]) => {
  const batch = build5Db().batch();
  for (const consumedOutput of consumedOutputIds) {
    const voteTransactionSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('payload_outputId', '==', consumedOutput)
      .where('payload_outputConsumed', '==', false)
      .limit(1)
      .get();
    if (!voteTransactionSnap.length) {
      continue;
    }

    const voteTransactionDocRef = build5Db().doc(COL.TRANSACTION, voteTransactionSnap[0].uid);
    const voteTransaction = voteTransactionSnap[0];
    const proposalDocRef = build5Db().doc(COL.PROPOSAL, voteTransaction.payload.proposalId!);
    const proposal = <Proposal>await proposalDocRef.get();

    if (dayjs().isAfter(proposal.settings.endDate.toDate())) {
      batch.update(voteTransactionDocRef, {
        payload_outputConsumed: true,
        payload_outputConsumedOn: dayjs().toDate(),
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
    const data: PgProposalUpdate = {
      results: {
        total: build5Db().inc(-prevWeight + currWeight),
        voted: build5Db().inc(-prevWeight + currWeight),
        answers: { [value.toString()]: build5Db().inc(-prevWeight + currWeight) },
      },
    };
    batch.update(proposalDocRef, data);

    const proposalMemberDocRef = build5Db().doc(
      COL.PROPOSAL,
      voteTransaction.payload.proposalId!,
      SUB_COL.MEMBERS,
      voteTransaction.member!,
    );
    batch.update(proposalMemberDocRef, {
      weight: build5Db().inc(-prevWeight + currWeight),
      values: { [voteTransaction.uid]: { weight: build5Db().inc(-prevWeight + currWeight) } },
    });

    batch.update(voteTransactionDocRef, {
      payload_weight: currWeight,
      payload_weightMultiplier: currWeightMultiplier,
      payload_outputConsumed: true,
      payload_outputConsumedOn: dayjs().toDate(),
    });
  }
  await batch.commit();
};
