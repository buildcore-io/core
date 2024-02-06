import {
  MintMetadataNftTangleRequest,
  NftBidTangleRequest,
  NftPurchaseBulkTangleRequest,
  NftPurchaseTangleRequest,
  NftSetForSaleTangleRequest,
  NftTransferTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * NFT OTR Dataset
 */
export class NftOtrDataset extends DatasetClass {
  /**
   * Purchase NFT via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link NftPurchaseTangleRequest}
   * @returns
   */
  purchase = (params: Omit<NftPurchaseTangleRequest, 'requestType'>) =>
    new OtrRequest<NftPurchaseTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.NFT_PURCHASE,
    });
  /**
   * Bid on NFT Auction
   *
   * @param params Use {@link OtrRequest} with data based on {@link AddressValidationTangleRequest}
   * @returns
   */
  bid = (params: Omit<NftBidTangleRequest, 'requestType'>) =>
    new OtrRequest<NftBidTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.NFT_BID,
    });
  /**
   * Set NFT for sale via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link NftSetForSaleTangleRequest}
   * @returns
   */
  setForSale = (params: Omit<NftSetForSaleTangleRequest, 'requestType'>) =>
    new OtrRequest<NftSetForSaleTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.NFT_SET_FOR_SALE,
      ...params,
    });
  /**
   * Mint Metadata NFT via OTR (i.e Digital Twin)
   *
   * @param params Use {@link OtrRequest} with data based on {@link MintMetadataNftTangleRequest}
   * @returns
   */
  mintMetadataNft = (params: Omit<MintMetadataNftTangleRequest, 'requestType'>) =>
    new OtrRequest<MintMetadataNftTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.MINT_METADATA_NFT,
      ...params,
    });
  /**
   * Bulk Purchase NFT via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link NftPurchaseBulkTangleRequest}
   * @returns
   */
  bulkPurchase = (params: Omit<NftPurchaseBulkTangleRequest, 'requestType'>) =>
    new OtrRequest<NftPurchaseBulkTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.NFT_PURCHASE_BULK,
      ...params,
    });
  /**
   * Transfer NFT deposited on platform via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link NftTransferTangleRequest}
   * @returns
   */
  transfer = (params: Omit<NftTransferTangleRequest, 'requestType'>) =>
    new OtrRequest<NftTransferTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.NFT_TRANSFER,
      ...params,
    });
}
