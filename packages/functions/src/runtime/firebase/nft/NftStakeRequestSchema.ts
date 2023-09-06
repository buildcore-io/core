import {
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  NftStakeRequest,
  StakeType,
} from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { toJoiObject } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));

export const stakeNftSchema = toJoiObject<NftStakeRequest>({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network on which the nft was staked.'),
  weeks: Joi.number()
    .integer()
    .min(MIN_WEEKS_TO_STAKE)
    .max(MAX_WEEKS_TO_STAKE)
    .required()
    .description(
      `Amount of weeks for which the NFT will be staked. Minimum ${MIN_WEEKS_TO_STAKE}, maximum ${MAX_WEEKS_TO_STAKE}`,
    ),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required()
    .description('Type of the stake.'),
})
  .description('Request object to create an NFT stake order.')
  .meta({
    className: 'NftStakeRequest',
  });
