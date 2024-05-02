import { build5Db } from '@build-5/database';
import { COL, ProposalType, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
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
      build5Db().doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, member.uid).create(member),
    );
    await Promise.all(memberPromisses);

    const transactionDocRef = build5Db().doc(COL.TRANSACTION, voteTransaction.uid);
    await transactionDocRef.create(voteTransaction);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    await proposalDocRef.create(proposal);
    return await proposalDocRef.get();
  };
