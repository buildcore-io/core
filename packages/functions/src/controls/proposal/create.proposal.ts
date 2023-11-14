import { build5Db } from '@build-5/database';
import { COL, Proposal, ProposalCreateRequest, SUB_COL } from '@build-5/interfaces';
import { createProposal } from '../../services/payment/tangle-service/proposal/ProposalCreateService';
import { Context } from '../common';

export const createProposalControl = async ({
  owner,
  params,
  project,
}: Context<ProposalCreateRequest>) => {
  const { proposal, proposalOwner } = await createProposal(project, owner, { ...params });

  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  await proposalDocRef.create(proposal);

  const proposalOwnerDocRef = proposalDocRef.collection(SUB_COL.OWNERS).doc(proposal.uid);
  await proposalOwnerDocRef.create(proposalOwner);

  return (await proposalDocRef.get<Proposal>())!;
};
