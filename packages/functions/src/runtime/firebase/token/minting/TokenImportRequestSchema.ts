import { ImportMintedTokenRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../../controls/common';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';
import { networks } from '../../../../utils/config.utils';

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));

export const importMintedTokenSchema = toJoiObject<ImportMintedTokenRequest>({
  tokenId: CommonJoi.uid().description('Network id of the minted token.'),
  space: CommonJoi.uid().description(
    'Build5 space id to which the token should be associated with.',
  ),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required()
    .description('Network name on which the token was minted.'),
})
  .description('Request object to create a token import order.')
  .meta({
    className: 'ImportMintedTokenRequest',
  });
