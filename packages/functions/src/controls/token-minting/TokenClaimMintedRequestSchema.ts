import { ClaimAirdroppedTokensRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const symbolSchema = toJoiObject<ClaimAirdroppedTokensRequest>({
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token to claim.'),
})
  .description('Request object to claim minted tokens.')
  .meta({
    className: 'ClaimAirdroppedTokensRequest',
  });
