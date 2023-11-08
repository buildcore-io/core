import { build5Db } from '@build-5/database';
import {
  COL,
  Proposal,
  ProposalCreateTangleResponse,
  ProposalMember,
  ProposalType,
  SpaceMember,
  SUB_COL,
  TokenStatus,
  WenError,
} from '@build-5/interfaces';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../../base';
import { proposalCreateSchemaObject } from './ProposalCreateTangleRequestSchema';

export class ProposalCreateService extends BaseService {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<ProposalCreateTangleResponse> => {
    const params = await assertValidationAsync(proposalCreateSchemaObject, request);

    const { proposal, proposalOwner } = await createProposal(project, owner, { ...params });

    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    this.transactionService.push({ ref: proposalDocRef, data: proposal, action: 'set' });

    const proposalOwnerDocRef = proposalDocRef.collection(SUB_COL.OWNERS).doc(proposalOwner.uid);
    this.transactionService.push({
      ref: proposalOwnerDocRef,
      data: proposalOwner,
      action: 'set',
    });

    return { proposal: proposal?.uid };
  };
}

export const createProposal = async (
  project: string,
  owner: string,
  params: Record<string, unknown>,
) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.space}`);
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
  const spaceMember = await spaceMemberDocRef.get<SpaceMember>();
  if (!spaceMember) {
    throw invalidArgument(WenError.you_are_not_part_of_space);
  }

  if (params.type === ProposalType.NATIVE) {
    const token = await getTokenForSpace(params.space as string);
    if (token?.status !== TokenStatus.MINTED) {
      throw invalidArgument(WenError.token_not_minted);
    }
    params.token = token.uid;
  }

  const settings = params.settings as Record<string, unknown>;
  const proposal = {
    ...params,
    settings: {
      ...settings,
      startDate: dateToTimestamp(settings.startDate as Date, true),
      endDate: dateToTimestamp(settings.endDate as Date, true),
    },
    project,
    uid: getRandomEthAddress(),
    rank: 1,
    createdBy: owner,
    approved: false,
    rejected: false,
    completed: false,
  } as Proposal;

  const totalWeight = await createProposalMembersAndGetTotalWeight(project, proposal);
  const results = {
    total: totalWeight * proposal.questions.length,
    voted: 0,
  };

  return {
    proposal: { ...proposal, totalWeight, results },
    proposalOwner: {
      project,
      uid: owner,
      parentId: proposal.uid,
      parentCol: COL.PROPOSAL,
    },
  };
};

const createProposalMembersAndGetTotalWeight = async (project: string, proposal: Proposal) => {
  const subCol = proposal.settings.onlyGuardians ? SUB_COL.GUARDIANS : SUB_COL.MEMBERS;
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${proposal.space}`);
  const spaceMembers = await spaceDocRef.collection(subCol).get<SpaceMember>();

  const promises = spaceMembers.map(async (spaceMember) => {
    const proposalMember = createProposalMember(project, proposal, spaceMember);
    if (proposalMember.weight || proposal.type === ProposalType.NATIVE) {
      const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
      await proposalDocRef
        .collection(SUB_COL.MEMBERS)
        .doc(proposalMember.uid)
        .create(proposalMember);
    }
    return proposalMember.weight || 0;
  });

  const proposalMemberWeights = await Promise.all(promises);
  return proposalMemberWeights.reduce((acc, act) => acc + act, 0);
};

const createProposalMember = (
  project: string,
  proposal: Proposal,
  spaceMember: SpaceMember,
): ProposalMember => ({
  project,
  uid: spaceMember.uid,
  weight: proposal.type === ProposalType.NATIVE ? 0 : 1,
  voted: false,
  parentId: proposal.uid,
  parentCol: COL.PROPOSAL,
});
