import { Proposal, ProposalMember } from '@build-5/interfaces';
import { head } from 'lodash';
import { build5Db } from '../../../../../firebase/firestore/build5Db';
import { createVoteTransaction } from './ProposalVoteService';

export const executeSimpleVoting = async (
  member: ProposalMember,
  proposal: Proposal,
  values: number[],
) => {
  const weight = member.weight || 0;
  const voteTransaction = createVoteTransaction(proposal, member.uid, weight, values);
  const proposalUpdateData = getProposalUpdateDataAfterVote(member, weight, values);
  const proposalMember = {
    uid: member.uid,
    voted: true,
    tranId: voteTransaction.uid,
    values: [{ [values[0]]: weight }],
  };
  return {
    proposal: proposalUpdateData,
    voteTransaction,
    proposalMember,
  };
};

const getProposalUpdateDataAfterVote = (
  proposalMember: ProposalMember,
  weight: number,
  values: number[],
) => {
  const prevAnswer = head(Object.keys(head(proposalMember.values) || {}));
  if (prevAnswer === values[0].toString()) {
    return { uid: proposalMember.parentId };
  }
  const data = {
    uid: proposalMember.parentId,
    results: {
      voted: build5Db().inc(proposalMember.voted ? 0 : weight),
      answers: { [`${values[0]}`]: build5Db().inc(weight) },
    },
  };
  if (prevAnswer) {
    data.results.answers[prevAnswer] = build5Db().inc(-weight);
  }
  return data;
};
