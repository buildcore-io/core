import { COL, Proposal, ProposalType, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { addRemoveGuardian } from '../../services/payment/tangle-service/space/SpaceGuardianService';

export const editGuardianControl =
  (type: ProposalType) => async (owner: string, params: Record<string, unknown>) => {
    const { proposal, voteTransaction, members } = await addRemoveGuardian(owner, params, type);

    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = members.map((member) => {
      proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).set(member);
    });
    await Promise.all(memberPromisses);

    const transactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    await transactionDocRef.create(voteTransaction);

    await proposalDocRef.create(proposal);
    return await proposalDocRef.get<Proposal>();
  };
