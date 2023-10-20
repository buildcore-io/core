import {
  COL,
  Proposal,
  ProposalType,
  SUB_COL,
  SpaceMemberUpsertRequest,
} from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { addRemoveGuardian } from '../../services/payment/tangle-service/space/SpaceGuardianService';
import { Context } from '../common';

export const editGuardianControl =
  (type: ProposalType) =>
  async ({ owner, params }: Context<SpaceMemberUpsertRequest>) => {
    const { proposal, voteTransaction, members } = await addRemoveGuardian(
      owner,
      { ...params },
      type,
    );

    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = members.map((member) => {
      proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).set(member);
    });
    await Promise.all(memberPromisses);

    const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    await transactionDocRef.create(voteTransaction);

    await proposalDocRef.create(proposal);
    return await proposalDocRef.get<Proposal>();
  };
