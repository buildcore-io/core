import { PgProposalUpdate, database } from '@buildcore/database';
import { COL, Proposal, SUB_COL, TransactionType } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { getTokenVoteMultiplier } from '../../services/payment/voting-service';

export const processConsumedVoteOutputs = async (consumedOutputIds: string[]) => {
  const batch = database().batch();
  for (const consumedOutput of consumedOutputIds) {
    const voteTransactionSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.VOTE)
      .where('payload_outputId', '==', consumedOutput)
      .where('payload_outputConsumed', '==', false)
      .limit(1)
      .get();
    if (!voteTransactionSnap.length) {
      continue;
    }

    const voteTransactionDocRef = database().doc(COL.TRANSACTION, voteTransactionSnap[0].uid);
    const voteTransaction = voteTransactionSnap[0];
    const proposalDocRef = database().doc(COL.PROPOSAL, voteTransaction.payload.proposalId!);
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
        total: database().inc(-prevWeight + currWeight),
        voted: database().inc(-prevWeight + currWeight),
        answers: { [value.toString()]: database().inc(-prevWeight + currWeight) },
      },
    };
    batch.update(proposalDocRef, data);

    const proposalMemberDocRef = database().doc(
      COL.PROPOSAL,
      voteTransaction.payload.proposalId!,
      SUB_COL.MEMBERS,
      voteTransaction.member!,
    );
    batch.update(proposalMemberDocRef, {
      weight: database().inc(-prevWeight + currWeight),
      values: { [voteTransaction.uid]: { weight: database().inc(-prevWeight + currWeight) } },
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
