import { COL, Proposal, SUB_COL } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createProposal } from '../../services/payment/tangle-service/proposal/ProposalCreateService';

export const createProposalControl = async (owner: string, params: Record<string, unknown>) => {
  const { proposal, proposalOwner } = await createProposal(owner, params);

  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  await proposalDocRef.create(proposal);

  const proposalOwnerDocRef = proposalDocRef.collection(SUB_COL.OWNERS).doc(proposal.uid);
  await proposalOwnerDocRef.create(proposalOwner);

  return await proposalDocRef.get<Proposal>();
};
