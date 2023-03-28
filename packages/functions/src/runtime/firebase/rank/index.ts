import { COL, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { rankControl } from '../../../controls/rank.control';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { RANK_CONFIG } from '../../../utils/config.utils';

const rankSchema = Joi.object({
  collection: Joi.string().equal(COL.COLLECTION, COL.TOKEN).required(),
  uid: CommonJoi.uid().required(),
  rank: Joi.number().integer().min(RANK_CONFIG.MIN_RANK).max(RANK_CONFIG.MAX_RANK).required(),
});

export const rankController = onCall(WEN_FUNC.rankController)(rankSchema, rankControl);
