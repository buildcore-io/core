import { ClaimAirdroppedTokensTangleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const tokenClaimSchema = toJoiObject<ClaimAirdroppedTokensTangleRequest>({
  ...baseTangleSchema,
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token.'),
})
  .description('Tangle request object to claim airdropped tokens.')
  .meta({
    className: 'ClaimAirdroppedTokensTangleRequest',
  });
