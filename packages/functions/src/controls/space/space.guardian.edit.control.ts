import { COL, Proposal, ProposalType, SUB_COL, URL_PATHS } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { addRemoveGuardian } from '../../services/payment/tangle-service/space/SpaceGuardianService';
import { cOn } from '../../utils/dateTime.utils';

export const editGuardianControl =
  (type: ProposalType) => async (owner: string, params: Record<string, unknown>) => {
    const { proposal, voteTransaction, members } = await addRemoveGuardian(owner, params, type);

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = members.map((member) => {
      proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).set(cOn(member));
    });
    await Promise.all(memberPromisses);

    const transactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    await transactionDocRef.create(cOn(voteTransaction));

    await proposalDocRef.create(cOn(proposal, URL_PATHS.PROPOSAL));
    return <Proposal>(await proposalDocRef.get()).data();
  };
