import { database } from '@buildcore/database';
import { COL, ProposalType, SUB_COL, SpaceMemberUpsertRequest } from '@buildcore/interfaces';
import { addRemoveGuardian } from '../../services/payment/tangle-service/space/SpaceGuardianService';
import { Context } from '../common';

export const editGuardianControl =
  (type: ProposalType) =>
  async ({ owner, params, project }: Context<SpaceMemberUpsertRequest>) => {
    const { proposal, voteTransaction, members } = await addRemoveGuardian(
      project,
      owner,
      { ...params },
      type,
    );
    const memberPromisses = members.map((member) =>
      database().doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, member.uid).create(member),
    );
    await Promise.all(memberPromisses);

    const transactionDocRef = database().doc(COL.TRANSACTION, voteTransaction.uid);
    await transactionDocRef.create(voteTransaction);

    const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
    await proposalDocRef.create(proposal);
    return await proposalDocRef.get();
  };
