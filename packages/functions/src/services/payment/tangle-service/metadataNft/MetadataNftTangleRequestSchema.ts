import { MintMetadataNftTangleRequest, TangleRequestType } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const metadataNftSchema = toJoiObject<MintMetadataNftTangleRequest>({
  ...baseTangleSchema(TangleRequestType.MINT_METADATA_NFT),
  nftId: CommonJoi.uid(false).description('Nft network id. Only specify it in case of edit.'),
  collectionId: CommonJoi.uid(false).description(
    'Collection tangle id. The new nft will belong to this collection.',
  ),
  aliasId: CommonJoi.uid(false).description(
    'Alias tangle id. The new nft will belong to this alias.',
  ),
  metadata: Joi.object().required().description('Metadata object of for the nft.'),
})
  .description('Tangle request object to create or update a metadata nft.')
  .meta({
    className: 'MintMetadataNftTangleRequest',
  });
