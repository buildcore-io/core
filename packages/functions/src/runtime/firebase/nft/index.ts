import {
  MAX_IOTA_AMOUNT,
  MAX_WEEKS_TO_STAKE,
  MIN_IOTA_AMOUNT,
  MIN_WEEKS_TO_STAKE,
  NftAccess,
  NftBidRequest,
  NftCreateRequest,
  NftDepositRequest,
  NftPurchaseRequest,
  NftSetForSaleRequest,
  NftStakeRequest,
  NftUpdateUnsoldRequest,
  NftWithdrawRequest,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { nftBidControl } from '../../../controls/nft/nft.bid.control';
import { createBatchNftControl, createNftControl } from '../../../controls/nft/nft.create';
import { depositNftControl } from '../../../controls/nft/nft.deposit';
import { orderNftControl } from '../../../controls/nft/nft.puchase.control';
import { setForSaleNftControl } from '../../../controls/nft/nft.set.for.sale';
import { nftStakeControl } from '../../../controls/nft/nft.stake';
import { updateUnsoldNftControl } from '../../../controls/nft/nft.update.unsold';
import { withdrawNftControl } from '../../../controls/nft/nft.withdraw';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';
import { networks } from '../../../utils/config.utils';

const nftCreateSchema = {
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  collection: CommonJoi.uid(),
  media: CommonJoi.storageUrl(false),
  availableFrom: Joi.date().required(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional(),
  properties: Joi.object().optional(),
  stats: Joi.object().optional(),
  saleAccessMembers: Joi.array().items(CommonJoi.uid(false)).optional(),
};
export const createNft = onRequest(WEN_FUNC.createNft)(
  toJoiObject<NftCreateRequest>(nftCreateSchema),
  createNftControl,
);

const createBatchNftSchema = Joi.array<NftCreateRequest[]>()
  .items(Joi.object().keys(nftCreateSchema))
  .min(1)
  .max(500);
export const createBatchNft = onRequest(WEN_FUNC.createBatchNft, {
  timeoutSeconds: 300,
  memory: '4GiB',
})(createBatchNftSchema, createBatchNftControl);

const updateUnsoldNftSchema = toJoiObject<NftUpdateUnsoldRequest>({
  uid: CommonJoi.uid(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
});
export const updateUnsoldNft = onRequest(WEN_FUNC.updateUnsoldNft)(
  updateUnsoldNftSchema,
  updateUnsoldNftControl,
);

const setNftForSaleSchema = toJoiObject<NftSetForSaleRequest>({
  nft: CommonJoi.uid().required(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  availableFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFloorPrice: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  auctionLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS),
  access: Joi.number().equal(NftAccess.OPEN, NftAccess.MEMBERS),
  accessMembers: Joi.array().when('access', {
    is: Joi.exist().valid(NftAccess.MEMBERS),
    then: Joi.array().items(CommonJoi.uid(false)).min(1),
  }),
});
export const setForSaleNft = onRequest(WEN_FUNC.setForSaleNft)(
  setNftForSaleSchema,
  setForSaleNftControl,
);

const nftWithdrawSchema = toJoiObject<NftWithdrawRequest>({ nft: CommonJoi.uid() });
export const withdrawNft = onRequest(WEN_FUNC.withdrawNft)(nftWithdrawSchema, withdrawNftControl);

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
const depositNftSchema = toJoiObject<NftDepositRequest>({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
});
export const depositNft = onRequest(WEN_FUNC.depositNft)(depositNftSchema, depositNftControl);

export const nftPurchaseSchema = toJoiObject<NftPurchaseRequest>({
  collection: CommonJoi.uid(),
  nft: CommonJoi.uid(false),
});
export const orderNft = onRequest(WEN_FUNC.orderNft)(nftPurchaseSchema, orderNftControl);

const stakeNftSchema = toJoiObject<NftStakeRequest>({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
  weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required(),
});
export const stakeNft = onRequest(WEN_FUNC.stakeNft)(stakeNftSchema, nftStakeControl);

const nftBidSchema = toJoiObject<NftBidRequest>({ nft: CommonJoi.uid() });
export const openBid = onRequest(WEN_FUNC.openBid)(nftBidSchema, nftBidControl);
