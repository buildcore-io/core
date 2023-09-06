import { NftCreateRequest, WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { nftBidControl } from '../../../controls/nft/nft.bid.control';
import { createBatchNftControl, createNftControl } from '../../../controls/nft/nft.create';
import { depositNftControl } from '../../../controls/nft/nft.deposit';
import { orderNftControl } from '../../../controls/nft/nft.puchase.control';
import { setForSaleNftControl } from '../../../controls/nft/nft.set.for.sale';
import { nftStakeControl } from '../../../controls/nft/nft.stake';
import { updateUnsoldNftControl } from '../../../controls/nft/nft.update.unsold';
import { withdrawNftControl } from '../../../controls/nft/nft.withdraw';
import { onRequest } from '../../../firebase/functions/onRequest';
import { nftBidSchema } from './NftBidRequestSchema';
import { createSchema, nftCreateSchema } from './NftCreateRequestSchema';
import { depositNftSchema } from './NftDepositRequestSchema';
import { nftPurchaseSchema } from './NftPurchaseRequestSchema';
import { setNftForSaleSchema } from './NftSetForSaleRequestSchema';
import { stakeNftSchema } from './NftStakeRequestSchema';
import { updateUnsoldNftSchema } from './NftUpdateUnsoldRequestSchema';
import { nftWithdrawSchema } from './NftWithdrawRequestSchema';

export const createNft = onRequest(WEN_FUNC.createNft)(nftCreateSchema, createNftControl);

export const createBatchNft = onRequest(WEN_FUNC.createBatchNft, {
  timeoutSeconds: 300,
  memory: '4GiB',
})(
  Joi.array<NftCreateRequest[]>().items(Joi.object().keys(createSchema)).min(1).max(500),
  createBatchNftControl,
);

export const updateUnsoldNft = onRequest(WEN_FUNC.updateUnsoldNft)(
  updateUnsoldNftSchema,
  updateUnsoldNftControl,
);

export const setForSaleNft = onRequest(WEN_FUNC.setForSaleNft)(
  setNftForSaleSchema,
  setForSaleNftControl,
);

export const withdrawNft = onRequest(WEN_FUNC.withdrawNft)(nftWithdrawSchema, withdrawNftControl);

export const depositNft = onRequest(WEN_FUNC.depositNft)(depositNftSchema, depositNftControl);

export const orderNft = onRequest(WEN_FUNC.orderNft)(nftPurchaseSchema, orderNftControl);

export const stakeNft = onRequest(WEN_FUNC.stakeNft)(stakeNftSchema, nftStakeControl);

export const openBid = onRequest(WEN_FUNC.openBid)(nftBidSchema, nftBidControl);
