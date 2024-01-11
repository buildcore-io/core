import {
  MintMetadataNftTangleRequest,
  NftBidTangleRequest,
  NftPurchaseBulkTangleRequest,
  NftPurchaseTangleRequest,
  NftSetForSaleTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class NftOtrDataset extends DatasetClass {
  purchase = (params: Omit<NftPurchaseTangleRequest, 'requestType'>) =>
    new OtrRequest<NftPurchaseTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.NFT_PURCHASE,
    });

  bid = (params: Omit<NftBidTangleRequest, 'requestType'>) =>
    new OtrRequest<NftBidTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.NFT_BID,
    });

  setForSale = (params: Omit<NftSetForSaleTangleRequest, 'requestType'>) =>
    new OtrRequest<NftSetForSaleTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.NFT_SET_FOR_SALE,
      ...params,
    });

  mintMetadataNft = (params: Omit<MintMetadataNftTangleRequest, 'requestType'>) =>
    new OtrRequest<MintMetadataNftTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.MINT_METADATA_NFT,
      ...params,
    });

  bulkPurchase = (params: Omit<NftPurchaseBulkTangleRequest, 'requestType'>) =>
    new OtrRequest<NftPurchaseBulkTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.NFT_PURCHASE_BULK,
      ...params,
    });
}
