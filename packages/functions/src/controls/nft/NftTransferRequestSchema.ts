import { NFT_TRANSFER_LIMIT, NftTransferRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const nftTransferObject = {
  nft: CommonJoi.uid().description('Buildcore id or tangle id of the nft.'),
  target: CommonJoi.uid().description('Buildcore id of a member or a tangle address.'),
  withdraw: Joi.boolean().optional().description('If set, NFT will be always withdrawn.'),
};

export const nftTransferSchema = toJoiObject<NftTransferRequest>({
  transfers: Joi.array()
    .items(Joi.object(nftTransferObject))
    .min(1)
    .max(NFT_TRANSFER_LIMIT)
    .description(
      `Provide list of NFTs to transfer to targetAddress or member id. Minimum 1, maximum ${NFT_TRANSFER_LIMIT}`,
    )
    .required(),
})
  .description('Request object to transfer NFTs')
  .meta({
    className: 'NftTransferRequest',
  });
