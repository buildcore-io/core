import { COL, Proposal, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createProposal } from '../../services/payment/tangle-service/proposal/ProposalCreateService';

export const createProposalControl = async (owner: string, params: Record<string, unknown>) => {
  const { proposal, proposalOwner } = await createProposal(owner, params);

  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  await proposalDocRef.create(proposal);

  const proposalOwnerDocRef = proposalDocRef.collection(SUB_COL.OWNERS).doc(proposal.uid);
  await proposalOwnerDocRef.create(proposalOwner);

  return await proposalDocRef.get<Proposal>();
};
