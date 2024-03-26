import { MintMetadataNftRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { AVAILABLE_NETWORKS } from '../common';

export const commonMetadataNftParams = {
  nftId: CommonJoi.uid(false).description('Nft network id. Only specify it in case of edit.'),
  collectionId: CommonJoi.uid(false).description(
    'Collection tangle id. The new nft will belong to this collection.',
  ),
  aliasId: CommonJoi.uid(false).description(
    'Alias tangle id. The new nft will belong to this alias.',
  ),
  metadata: Joi.object().required().description('Metadata object of for the nft.'),
};

export const metadataNftSchema = toJoiObject<MintMetadataNftRequest>({
  ...commonMetadataNftParams,
  network: Joi.string()
    .valid(...AVAILABLE_NETWORKS)
    .description('Network on which the NFT will be minted.')
    .required(),
})
  .description('Request object to create or update a metadata nft.')
  .meta({
    className: 'MintMetadataNftRequest',
  });
