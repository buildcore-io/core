import { NftDepositRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { toJoiObject } from '../../services/joi/common';
import { networks } from '../../utils/config.utils';
import { AVAILABLE_NETWORKS } from '../common';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
export const depositNftSchema = toJoiObject<NftDepositRequest>({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network on which the nft was minted.'),
})
  .description('Request object to create an NFT deposit order')
  .meta({
    className: 'NftDepositRequest',
  });
