import {
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  NftAccess,
  NftAvailableFromDateMin,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { createBatchNftControl, createNftControl } from '../../../controls/nft/nft.create';
import { depositNftControl } from '../../../controls/nft/nft.deposit';
import { orderNftControl } from '../../../controls/nft/nft.puchase.control';
import { setForSaleNftControl } from '../../../controls/nft/nft.set.for.sale';
import { updateUnsoldNftControl } from '../../../controls/nft/nft.update.unsold';
import { withdrawNftControl } from '../../../controls/nft/nft.withdraw';
import { onCall } from '../../../firebase/functions/onCall';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';
import { isProdEnv, networks } from '../../../utils/config.utils';

const nftCreateSchema = {
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  collection: CommonJoi.uid(),
  media: CommonJoi.storageUrl(false),
  // On test we allow now.
  availableFrom: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? NftAvailableFromDateMin.value : -600000, 'ms')
        .toDate(),
    )
    .required(),
  // Minimum 10Mi price required and max 1Ti
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional(),
  // TODO Validate.
  properties: Joi.object().optional(),
  stats: Joi.object().optional(),
};
export const createNft = onCall({
  minInstances: scale(WEN_FUNC.cNft),
})(WEN_FUNC.cNft, Joi.object(nftCreateSchema), createNftControl);

const createBatchNftSchema = Joi.array().items(Joi.object().keys(nftCreateSchema)).min(1).max(500);
export const createBatchNft = onCall({
  minInstances: scale(WEN_FUNC.cBatchNft),
  timeoutSeconds: 300,
  memory: '4GB',
})(WEN_FUNC.cBatchNft, createBatchNftSchema, createBatchNftControl);

const updateUnsoldNftSchema = Joi.object({
  uid: CommonJoi.uid(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
});
export const updateUnsoldNft = onCall({
  minInstances: scale(WEN_FUNC.updateUnsoldNft),
})(WEN_FUNC.updateUnsoldNft, updateUnsoldNftSchema, updateUnsoldNftControl);

const setNftForSaleSchema = Joi.object({
  nft: CommonJoi.uid().required(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  availableFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFrom: Joi.date().greater(dayjs().subtract(600000, 'ms').toDate()),
  auctionFloorPrice: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT),
  auctionLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS),
  access: Joi.number().equal(NftAccess.OPEN, NftAccess.MEMBERS),
  accessMembers: Joi.when('access', {
    is: Joi.exist().valid(NftAccess.MEMBERS),
    then: Joi.array().items(CommonJoi.uid(false)).min(1),
  }),
});
export const setForSaleNft = onCall({
  minInstances: scale(WEN_FUNC.setForSaleNft),
})(WEN_FUNC.setForSaleNft, setNftForSaleSchema, setForSaleNftControl);

const nftWithdrawSchema = Joi.object({ nft: CommonJoi.uid() });
export const withdrawNft = onCall({
  minInstances: scale(WEN_FUNC.withdrawNft),
})(WEN_FUNC.withdrawNft, nftWithdrawSchema, withdrawNftControl);

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
const depositNftSchema = Joi.object({
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
});
export const depositNft = onCall({
  minInstances: scale(WEN_FUNC.depositNft),
})(WEN_FUNC.depositNft, depositNftSchema, depositNftControl);

const nftPurchaseSchema = Joi.object({
  collection: CommonJoi.uid(),
  nft: CommonJoi.uid(false),
});

export const orderNft = onCall({
  minInstances: scale(WEN_FUNC.orderNft),
})(WEN_FUNC.orderNft, nftPurchaseSchema, orderNftControl);
