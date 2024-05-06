import { database } from '@buildcore/database';
import { COL, ProposalCreateRequest, SUB_COL } from '@buildcore/interfaces';
import { createProposal } from '../../services/payment/tangle-service/proposal/ProposalCreateService';
import { Context } from '../common';

export const createProposalControl = async ({
  owner,
  params,
  project,
}: Context<ProposalCreateRequest>) => {
  const { proposal, proposalOwner } = await createProposal(project, owner, { ...params });

  const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
  await proposalDocRef.create(proposal);

  const proposalOwnerDocRef = database().doc(
    COL.PROPOSAL,
    proposal.uid,
    SUB_COL.OWNERS,
    proposal.uid,
  );
  await proposalOwnerDocRef.create(proposalOwner);

  return (await proposalDocRef.get())!;
};
