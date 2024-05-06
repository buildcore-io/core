import { MintMetadataNftTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { commonMetadataNftParams } from '../../../../controls/nft/NftMetadataRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const metadataNftSchema = toJoiObject<MintMetadataNftTangleRequest>({
  ...baseTangleSchema(TangleRequestType.MINT_METADATA_NFT),
  ...commonMetadataNftParams,
})
  .description('Tangle request object to create or update a metadata nft.')
  .meta({
    className: 'MintMetadataNftTangleRequest',
  });
