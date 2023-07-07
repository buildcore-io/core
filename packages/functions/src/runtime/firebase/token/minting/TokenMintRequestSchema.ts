import { TokenMintRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../../controls/common';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';
import { networks } from '../../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));

export const mintTokenSchema = toJoiObject<TokenMintRequest>({
  token: CommonJoi.uid().description('Build5 id of the token to mint.'),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network to use to mint the token.'),
})
  .description('Request object to mint a tokens.')
  .meta({
    className: 'TokenMintRequest',
  });
