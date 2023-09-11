import { ProposalVoteTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { voteOnProposalSchema } from '../../../../../runtime/firebase/proposal/ProposalVoteRequestSchema';
import { toJoiObject } from '../../../../joi/common';
import { baseTangleSchema } from '../../common';

export const voteOnProposalSchemaObject = toJoiObject<ProposalVoteTangleRequest>({
  ...baseTangleSchema(TangleRequestType.PROPOSAL_VOTE),
  ...voteOnProposalSchema,
})
  .description('Tangle request object to vote on a proposal')
  .meta({
    className: 'ProposalVoteTangleRequest',
  });
