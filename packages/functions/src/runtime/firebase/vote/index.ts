import { COL, VoteRequest, WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { voteControl } from '../../../controls/vote.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

const voteSchema = toJoiObject<VoteRequest>({
  collection: Joi.string().equal(COL.COLLECTION, COL.TOKEN).required(),
  uid: CommonJoi.uid().required(),
  direction: Joi.number().equal(-1, 0, 1).required(),
});

export const voteController = onRequest(WEN_FUNC.voteController)(voteSchema, voteControl);
