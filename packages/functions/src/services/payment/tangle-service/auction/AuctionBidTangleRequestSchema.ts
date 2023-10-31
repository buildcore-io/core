import { AuctionBidTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const auctionBidTangleSchema = toJoiObject<AuctionBidTangleRequest>({
  ...baseTangleSchema(TangleRequestType.BID_AUCTION),
  auction: CommonJoi.uid().description('Build5 id of the auction to bid on.'),
})
  .description('Tangle request object to create an auction bid')
  .meta({
    className: 'AuctionBidTangleRequest',
  });
