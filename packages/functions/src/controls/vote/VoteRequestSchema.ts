import { COL, VoteRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const voteSchema = toJoiObject<VoteRequest>({
  collection: Joi.string()
    .equal(COL.COLLECTION, COL.TOKEN)
    .required()
    .description('Buildcore collection to vote on.'),
  uid: CommonJoi.uid().required().description('Buildcore id of the entity to vote on.'),
  direction: Joi.number().equal(-1, 0, 1).required().description('Direction of the vote.'),
})
  .description('Request object to vote an entity.')
  .meta({
    className: 'VoteRequest',
  });
