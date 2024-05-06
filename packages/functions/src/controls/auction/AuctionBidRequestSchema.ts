import { AuctionBidRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const auctionBidSchema = toJoiObject<AuctionBidRequest>({
  auction: CommonJoi.uid().description('Buildcore id of the auction.'),
})
  .description('Request object to create a bid order.')
  .meta({
    className: 'AuctionBidRequest',
  });
