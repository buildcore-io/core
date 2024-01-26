import {
  NFT_TRANSFER_LIMIT,
  NftTransferTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import Joi from 'joi';
import { nftTransferObject } from '../../../../controls/nft/NftTransferRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const nftTangleTransferSchema = toJoiObject<NftTransferTangleRequest>({
  ...baseTangleSchema(TangleRequestType.NFT_TRANSFER),
  transfers: Joi.array()
    .items(Joi.object(nftTransferObject))
    .min(1)
    .max(NFT_TRANSFER_LIMIT)
    .description(
      `Provide list of NFTs to transfer to targetAddress or member id. Minimum 1, maximum ${NFT_TRANSFER_LIMIT}`,
    )
    .required(),
})
  .description('Tangle request object to transfer NFTs')
  .meta({
    className: 'NftTransferTangleRequest',
  });
