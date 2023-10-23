import { ProposalVoteRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const voteOnProposalSchema = {
  uid: CommonJoi.uid().description('Build5 id of the proposal to vote on.'),
  value: Joi.number().required().description('Value of the vote.'),
  voteWithStakedTokes: Joi.bool()
    .optional()
    .description('If true voting will be done with staked tokens.'),
};

export const voteOnProposalSchemaObject = toJoiObject<ProposalVoteRequest>(voteOnProposalSchema)
  .description('Request object to vote on a proposal')
  .meta({
    className: 'ProposalVoteRequest',
  });
