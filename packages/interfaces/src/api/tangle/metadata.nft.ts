import { EthAddress } from '../../models';

export interface MintMetadataNftTangleRequest {
  nftId?: EthAddress;
  collectionId?: EthAddress;
  aliasId?: EthAddress;
  metadata: { [key: string]: unknown };
}
