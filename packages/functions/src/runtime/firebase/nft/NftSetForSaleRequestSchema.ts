import {
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  NftAccess,
  NftSetForSaleRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

const minAvailableFrom = 10;

export const setNftForSaleSchema = toJoiObject<NftSetForSaleRequest>({
  nft: CommonJoi.uid().required().description('Build5 id of the nft.'),
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
  auctionLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .description(
      `Millisecond value of the auction length. Minimum ${TRANSACTION_AUTO_EXPIRY_MS}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
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
})
  .description('Request object to set an NFT for sale.')
  .meta({
    className: 'NftSetForSaleRequest',
  });
