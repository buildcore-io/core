import {
  COL,
  Proposal,
  ProposalMember,
  ProposalSubType,
  ProposalType,
  SpaceMember,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionAwardType,
  WenError,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { Database } from '../../../../database/Database';
import { createProposalSchema } from '../../../../runtime/firebase/proposal';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { TransactionService } from '../../transaction-service';

export class ProposalCreateService {
  constructor(readonly transactionService: TransactionService) {}

  public handleProposalCreateRequest = async (owner: string, request: Record<string, unknown>) => {
    delete request.requestType;
    await assertValidationAsync(Joi.object(createProposalSchema), request);

    const proposal = await createProposal(owner, request);
    return { proposal: proposal?.uid };
  };
}

export const createProposal = async (owner: string, params: Record<string, unknown>) => {
  const spaceMember = await Database.getById<SpaceMember>(
    COL.SPACE,
    params.space as string,
    SUB_COL.MEMBERS,
    owner,
  );
  if (!spaceMember) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  if (params.type === ProposalType.NATIVE) {
    const token = await getTokenForSpace(params.space as string);
    if (token?.status !== TokenStatus.MINTED) {
      throw throwInvalidArgument(WenError.token_not_minted);
    }
    params.token = token.uid;
  }

  const settings = params.settings as Record<string, unknown>;
  const proposal = <Proposal>{
    ...params,
    settings: {
      ...settings,
      startDate: dateToTimestamp(settings.startDate as Date, true),
      endDate: dateToTimestamp(settings.endDate as Date, true),
    },
    uid: getRandomEthAddress(),
    rank: 1,
    createdBy: owner,
    approved: false,
    rejected: false,
    completed: false,
  };

  const totalWeight = await createProposalMembersAndGetTotalWeight(proposal);
  const results = {
    total: totalWeight * proposal.questions.length,
    voted: 0,
  };

  await Database.create(COL.PROPOSAL, { ...proposal, totalWeight, results });
  await Database.create(
    COL.PROPOSAL,
    {
      uid: owner,
      parentId: proposal.uid,
      parentCol: COL.PROPOSAL,
    },
    SUB_COL.OWNERS,
    proposal.uid,
  );

  return await Database.getById<Proposal>(COL.PROPOSAL, proposal.uid);
};

const createProposalMembersAndGetTotalWeight = async (proposal: Proposal) => {
  const subCol = proposal.settings.onlyGuardians ? SUB_COL.GUARDIANS : SUB_COL.MEMBERS;
  const spaceMembers = await Database.getAll<SpaceMember>(
    COL.SPACE,
    proposal.space as string,
    subCol,
  );

  const promises = spaceMembers.map(async (spaceMember) => {
    const proposalMember = await createProposalMember(proposal, spaceMember);
    if (proposalMember.weight || proposal.type === ProposalType.NATIVE) {
      await Database.update(COL.PROPOSAL, proposalMember, SUB_COL.MEMBERS, proposal.uid);
    }
    return proposalMember.weight || 0;
  });

  const proposalMemberWeights = await Promise.all(promises);
  return proposalMemberWeights.reduce((acc, act) => acc + act, 0);
};

const createProposalMember = async (proposal: Proposal, spaceMember: SpaceMember) => {
  const defaultWeight = proposal.settings.defaultMinWeight || 0;
  const votingWeight = await calculateVotingWeight(proposal, spaceMember.uid);
  const weight = Math.max(votingWeight, defaultWeight);
  return <ProposalMember>{
    uid: spaceMember.uid,
    weight,
    voted: false,
    parentId: proposal.uid,
    parentCol: COL.PROPOSAL,
  };
};

const calculateVotingWeight = async (proposal: Proposal, member: string) => {
  if (proposal.type === ProposalType.NATIVE) {
    return 0;
  }
  if (
    proposal.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE ||
    proposal.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS
  ) {
    let weight = 0;
    await Database.getManyPaginated<Transaction>(COL.TRANSACTION, {
      ['payload.type']: TransactionAwardType.BADGE,
      member,
    })(async (badges) => {
      for (const badge of badges) {
        weight += getReputationFromBadge(proposal, badge);
      }
    });
    return weight;
  }
  return 1;
};

const getReputationFromBadge = (proposal: Proposal, badge: Transaction) => {
  if (proposal.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
    if (proposal.settings.awards.includes(badge.payload.award)) {
      return badge.payload?.tokenReward || 0;
    }
    return 0;
  }
  if (badge.space === proposal.space) {
    return Math.trunc(badge.payload?.tokenReward || 0);
  }
  return 0;
};
