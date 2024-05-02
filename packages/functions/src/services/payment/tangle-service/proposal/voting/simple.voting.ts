import { database } from '@buildcore/database';
import { Proposal, ProposalMember } from '@buildcore/interfaces';
import { head } from 'lodash';
import { createVoteTransaction } from './ProposalVoteService';

export const executeSimpleVoting = (
  project: string,
  member: ProposalMember,
  proposal: Proposal,
  values: number[],
) => {
  const weight = member.weight || 0;
  const voteTransaction = createVoteTransaction(project, proposal, member.uid, weight, values);
  const proposalUpdateData = getProposalUpdateDataAfterVote(member, weight, values);
  const proposalMember = {
    uid: member.uid,
    voted: true,
    tranId: voteTransaction.uid,
    values: JSON.stringify({ [voteTransaction.uid]: { value: values[0], weight } }),
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
    return undefined;
  }
  const data = {
    results: {
      voted: database().inc(proposalMember.voted ? 0 : weight),
      answers: { [`${values[0]}`]: database().inc(weight) },
    },
  };
  if (prevAnswer) {
    data.results.answers[prevAnswer] = database().inc(-weight);
  }
  return data;
};
