import {
  AuctionCreateRequest,
  EXTEND_AUCTION_WITHIN,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { AVAILABLE_NETWORKS } from '../common';

const minAvailableFrom = 10;
const minBids = 1;
const maxBids = 10;

export const auctionCreateSchema = {
  space: CommonJoi.uid().description('Build5 id of the space'),
  auctionFrom: Joi.date()
    .greater(dayjs().subtract(minAvailableFrom, 'minutes').toDate())
    .required()
    .description(
      `Starting date of the auction. Can not be sooner then ${minAvailableFrom} minutes.`,
    ),
  auctionFloorPrice: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .required()
    .description(
      `Floor price of the auction. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`,
    ),
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
    .required()
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
  maxBids: Joi.number()
    .integer()
    .min(minBids)
    .max(maxBids)
    .required()
    .description(
      `Specifies the maximum number of active bids. Minimum ${minBids}, maximum ${maxBids}`,
    ),
  network: Joi.string()
    .valid(...AVAILABLE_NETWORKS)
    .description('Network on which this auction accepts bids.')
    .required(),
  topUpBased: Joi.boolean().description(
    'If set to true, consequent bids from the same user will be treated as topups',
  ),
  targetAddress: Joi.string().description('A valid network address where funds will be sent.'),
};

export const auctionCreateSchemaObject = toJoiObject<AuctionCreateRequest>(auctionCreateSchema)
  .description('Request object to create an auction.')
  .meta({
    className: 'AuctionCreateRequest',
  });
