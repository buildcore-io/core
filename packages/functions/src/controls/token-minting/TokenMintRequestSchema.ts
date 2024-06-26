import { TokenMintRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { networks } from '../../utils/config.utils';
import { AVAILABLE_NETWORKS } from '../common';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));

export const mintTokenSchema = toJoiObject<TokenMintRequest>({
  token: CommonJoi.uid().description('Buildcore id of the token to mint.'),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network to use to mint the token.'),
})
  .description('Request object to mint a tokens.')
  .meta({
    className: 'TokenMintRequest',
  });
