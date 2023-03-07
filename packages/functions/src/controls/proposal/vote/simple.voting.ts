import {
  COL,
  Proposal,
  ProposalMember,
  RelatedRecordsResponse,
  SUB_COL,
} from '@soonaverse/interfaces';
import { head } from 'lodash';
import admin, { inc } from '../../../admin.config';
import { cOn, uOn } from '../../../utils/dateTime.utils';
import { createVoteTransaction } from './vote.on.proposal';

export const executeSimpleVoting = async (
  proposal: Proposal,
  member: ProposalMember,
  params: Record<string, unknown>,
) => {
  const weight = member.weight || 0;
  const values = params.values as number[];

  const voteTransaction = createVoteTransaction(proposal, member.uid, weight, values);

  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid);

  const batch = admin.firestore().batch();

  const voteTransactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
  batch.create(voteTransactionDocRef, cOn(voteTransaction));

  batch.update(
    proposalMemberDocRef,
    uOn({
      voted: true,
      tranId: voteTransaction.uid,
      values: [{ [values[0]]: weight }],
    }),
  );

  const data = getProposalUpdateDataAfterVote(proposal, member, weight, values);
  batch.set(proposalDocRef, uOn(data), { merge: true });

  await batch.commit();

  if (RelatedRecordsResponse.status) {
    return {
      ...voteTransaction,
      ...{ _relatedRecs: { proposal: (await proposalDocRef.get()).data() } },
    };
  } else {
    return voteTransaction;
  }
};

const getProposalUpdateDataAfterVote = (
  proposal: Proposal,
  proposalMember: ProposalMember,
  weight: number,
  values: number[],
) => {
  const prevAnswer = head(Object.keys(head(proposalMember.values) || {}));
  if (prevAnswer === values[0].toString()) {
    return {};
  }
  const data = {
    results: {
      voted: inc(proposalMember.voted ? 0 : weight),
      answers: { [`${values[0]}`]: inc(weight) },
    },
  };
  if (prevAnswer) {
    data.results.answers[prevAnswer] = inc(-weight);
  }
  return data;
};
