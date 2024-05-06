import { Dataset, Network } from '@buildcore/interfaces';
import { v4 as uuid } from 'uuid';
import { AuctionOtrDataset } from './AuctionOtrDataset';
import { AwardOtrDataset } from './AwardOtrDataset';
import { MemberOtrDataset } from './MemberOtrDataset';
import { NftOtrDataset } from './NftOtrDataset';
import { ProposalOtrDataset } from './ProposalOtrDataset';
import { SpaceOtrDataset } from './SpaceOtrDataset';
import { StamptOtrDataset } from './StampOtrDataset';
import { SwapOtrDataset } from './SwapOtrDataset';
import { TokenOtrDataset } from './TokenOtrDataset';

// prettier-ignore
export type DatasetType<T extends Dataset> = 
  T extends Dataset.AUCTION ? AuctionOtrDataset:
  T extends Dataset.AWARD ? AwardOtrDataset:
  T extends Dataset.MEMBER ? MemberOtrDataset:
  T extends Dataset.NFT ? NftOtrDataset:
  T extends Dataset.PROPOSAL ? ProposalOtrDataset:
  T extends Dataset.SPACE ? SpaceOtrDataset:
  T extends Dataset.STAMP ? StamptOtrDataset:
  T extends Dataset.TOKEN ? TokenOtrDataset:
  T extends Dataset.SWAP ? SwapOtrDataset:
  unknown;

export interface INativeToken {
  id: string;
  amount: bigint;
}

export abstract class DatasetClass {
  constructor(protected readonly otrAddress: string) {}
}

/**
 * OTR Request base class.
 *
 */
export class OtrRequest<T> {
  constructor(
    public readonly otrAddress: string,
    public readonly metadata: T,
    public readonly amount?: number,
    public readonly nativeToken?: INativeToken,
  ) {}

  /**
   * Prepare required metadata based on your request to be sent to Tangle.
   *
   * @returns
   */
  getMetadata = () => ({
    targetAddress: this.otrAddress,
    metadata: { request: this.metadata },
    nativeToken: this.nativeToken,
    tag: this.generateTag(),
    amount: this.amount,
  });

  /**
   * Get Firefly deeplink with required data to submit request via tangle.
   *
   * @returns
   */
  getFireflyDeepLink = () => {
    const { metadata, nativeToken, tag } = this.getMetadata();
    const walletType = getFireflyWalletType(this.otrAddress);
    return (
      walletType +
      `://wallet/sendConfirmation?address=${this.otrAddress}` +
      '&disableToggleGift=true&disableChangeExpiration=true' +
      `&amount=${nativeToken ? nativeToken.amount : this.amount || 0}` +
      `&tag=${tag}&giftStorageDeposit=true` +
      `&metadata=${JSON.stringify(metadata)}` +
      (nativeToken ? `&assetId=${nativeToken?.id}` : '')
    );
  };

  /**
   * Get Bloom deeplink with required data to submit request via tangle.
   *
   * @returns
   */
  getBloomDeepLink = () => {
    const { metadata, nativeToken, tag, amount } = this.getMetadata();
    const parameters = {
      address: this.otrAddress,
      baseCoinAmount: Number(amount || 0).toFixed(0),
      tokenId: nativeToken?.id,
      tokenAmount: nativeToken ? Number(nativeToken.amount).toFixed(0) : undefined,
      tag,
      giftStorageDeposit: true,
      disableToggleGift: true,
      disableChangeExpiration: true,
      disableChangeTimelock: true,
      metadata: JSON.stringify(metadata),
    };

    const searchParams = Object.entries(parameters)
      .filter((e) => e[1] !== undefined)
      .map((e) => `${e[0]}=${e[1]}`)
      .join('&');

    return `bloom://wallet/sendTransaction?${searchParams}`;
  };

  /**
   * Generate unique tag to be able to track OTR progress via {@link ProjectWrapper.trackByTag}
   *
   * @returns
   */
  generateTag = () => uuid().replace(/-/g, '');

  /**
   * Get tag that was generated for the OTR request.
   *
   * @param deeplink
   * @returns
   */
  getTag = (deeplink: string) => {
    const search = 'tag=';
    const startIndex = deeplink.indexOf(search);
    const endIndex = deeplink.indexOf('&', startIndex + search.length);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return '';
    }
    return deeplink.substring(startIndex + search.length, endIndex);
  };
}

/**
 * Detect wallet type based on the address.
 *
 * @param otrAddress
 * @returns
 */
const getFireflyWalletType = (otrAddress: string) => {
  if (otrAddress.startsWith(Network.SMR) || otrAddress.startsWith(Network.RMS)) {
    return 'firefly';
  }
  if (otrAddress.startsWith(Network.IOTA)) {
    return 'iota';
  }
  throw Error('Invalid otr address, ono firefly wallet type found');
};

/**
 * Detect {@link Network} based on the address
 *
 * @param address
 * @returns
 */
export const otrAddressToNetwork = (address: string): Network => {
  for (const network of Object.values(Network)) {
    if (address.startsWith(network)) {
      return network as Network;
    }
  }
  throw Error('Invalid otr address');
};
