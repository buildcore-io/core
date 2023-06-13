import { COL, WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { rankControl } from '../../../controls/rank.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';
import { RANK_CONFIG } from '../../../utils/config.utils';

const rankSchema = Joi.object({
  collection: Joi.string().equal(COL.COLLECTION, COL.TOKEN).required(),
  uid: CommonJoi.uid().required(),
  rank: Joi.number().integer().min(RANK_CONFIG.MIN_RANK).max(RANK_CONFIG.MAX_RANK).required(),
});

export const rankController = onRequest(WEN_FUNC.rankController)(rankSchema, rankControl);
