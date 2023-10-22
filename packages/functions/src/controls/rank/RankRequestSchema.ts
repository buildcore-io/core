import { COL, RankRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { RANK_CONFIG } from '../../utils/config.utils';

export const rankSchema = toJoiObject<RankRequest>({
  collection: Joi.string()
    .equal(COL.COLLECTION, COL.TOKEN)
    .required()
    .description('Build5 collection name to rank.'),
  uid: CommonJoi.uid().description('Build5 id of the entity to rank.'),
  rank: Joi.number()
    .integer()
    .min(RANK_CONFIG.MIN_RANK)
    .max(RANK_CONFIG.MAX_RANK)
    .required()
    .description(`Rank value. Minimum ${RANK_CONFIG.MIN_RANK}, maximum ${RANK_CONFIG.MAX_RANK}`),
})
  .description('Request object to rank a collection or token.')
  .meta({
    className: 'RankRequest',
  });
