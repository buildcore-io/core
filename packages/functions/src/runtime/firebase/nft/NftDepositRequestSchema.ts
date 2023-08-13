import { NftDepositRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { toJoiObject } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
export const depositNftSchema = toJoiObject<NftDepositRequest>({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network on wich the nft was minted.'),
})
  .description('Request object to create an NFT deposit order')
  .meta({
    className: 'NftDepositRequest',
  });
