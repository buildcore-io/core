import { ClaimAirdroppedTokensTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const tokenClaimSchema = toJoiObject<ClaimAirdroppedTokensTangleRequest>({
  ...baseTangleSchema(TangleRequestType.CLAIM_MINTED_AIRDROPS),
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token.'),
})
  .description('Tangle request object to claim airdropped tokens.')
  .meta({
    className: 'ClaimAirdroppedTokensTangleRequest',
  });
