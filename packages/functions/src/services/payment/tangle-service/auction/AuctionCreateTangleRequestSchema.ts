import { AuctionCreateTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { auctionCreateSchema } from '../../../../controls/auction/AuctionCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const auctionCreateTangleSchema = toJoiObject<AuctionCreateTangleRequest>({
  ...baseTangleSchema(TangleRequestType.CREATE_AUCTION),
  ...auctionCreateSchema,
})
  .description('Request object to create an auction.')
  .meta({
    className: 'AuctionCreateTangleRequest',
  });
