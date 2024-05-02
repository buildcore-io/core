import {
  MintMetadataNftTangleRequest,
  NftBidTangleRequest,
  NftPurchaseBulkTangleRequest,
  NftPurchaseTangleRequest,
  NftSetForSaleTangleRequest,
  NftTransferTangleRequest,
  TangleRequestType,
} from '@buildcore/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * NFT OTR Dataset
 */
export class NftOtrDataset extends DatasetClass {
  /**
   * Purchase NFT via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link NftPurchaseTangleRequest}
   * @param amount Custom amount used for the cretion of the deep link
   * @returns
   */
  purchase = (params: Omit<NftPurchaseTangleRequest, 'requestType'>, amount = 0) =>
    new OtrRequest<NftPurchaseTangleRequest>(
      this.otrAddress,
      {
        ...params,
        requestType: TangleRequestType.NFT_PURCHASE,
      },
      amount,
    );
  /**
   * Bid on NFT Auction
   *
   * @param params Use {@link OtrRequest} with data based on {@link AddressValidationTangleRequest}
   * @param amount Custom amount used for the cretion of the deep link
   * @returns
   */
  bid = (params: Omit<NftBidTangleRequest, 'requestType'>, amount = 0) =>
    new OtrRequest<NftBidTangleRequest>(
      this.otrAddress,
      {
        ...params,
        requestType: TangleRequestType.NFT_BID,
      },
      amount,
    );
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
