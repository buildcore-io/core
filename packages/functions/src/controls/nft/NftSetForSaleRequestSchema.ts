import {
  EXTEND_AUCTION_WITHIN,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  NftAccess,
  NftSetForSaleRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

const minAvailableFrom = 10;

export const baseNftSetForSaleSchema = {
  nft: CommonJoi.uid().description('Build5 id of the nft.'),
  price: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .description(`Price of the nft. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`),
  availableFrom: Joi.date()
    .greater(dayjs().subtract(minAvailableFrom, 'minutes').toDate())
    .description(
      `Starting date of the nft's availability. Can not be sooner then ${minAvailableFrom} minutes.`,
    ),
  auctionFrom: Joi.date()
    .greater(dayjs().subtract(minAvailableFrom, 'minutes').toDate())
    .description(
      `Starting date of the nft's auction. Can not be sooner then ${minAvailableFrom} minutes.`,
    ),
  auctionFloorPrice: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .description(`Floor price of the nft. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`),
  minimalBidIncrement: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .optional()
    .description(
      `Defines the minimum increment of a subsequent bid. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`,
    ),
  auctionLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .description(
      `Millisecond value of the auction length. Minimum ${TRANSACTION_AUTO_EXPIRY_MS}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
    ),
  extendedAuctionLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .greater(Joi.ref('auctionLength'))
    .description(
      'If set, auction will automatically extended by this length if a bid comes in within {@link extendAuctionWithin} before the end of the auction.',
    ),
  extendAuctionWithin: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .description(
      'Auction will be extended if a bid happens this many milliseconds before auction ends. ' +
        `Default value is ${EXTEND_AUCTION_WITHIN} minutes`,
    ),
  access: Joi.number()
    .equal(NftAccess.OPEN, NftAccess.MEMBERS)
    .description('Access type of this sale.'),
  accessMembers: Joi.array()
    .when('access', {
      is: Joi.exist().valid(NftAccess.MEMBERS),
      then: Joi.array().items(CommonJoi.uid(false)).min(1),
    })
    .description('If present, members who can buy this nft'),
};

export const setNftForSaleSchema = toJoiObject<NftSetForSaleRequest>(baseNftSetForSaleSchema)
  .description('Request object to set an NFT for sale.')
  .meta({
    className: 'NftSetForSaleRequest',
  });
