import { ClaimPreMintedAirdroppedTokensRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { toJoiObject } from '../../services/joi/common';

export const claimAirdroppedTokenSchema = toJoiObject<ClaimPreMintedAirdroppedTokensRequest>({
  token: Joi.string().required().description('Buildcore id of the token.'),
})
  .description('Request object to claim airdrops.')
  .meta({
    className: 'ClaimPreMintedAirdroppedTokensRequest',
  });
