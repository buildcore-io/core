import { Dataset, Network } from '@build-5/interfaces';
import { v4 as uuid } from 'uuid';
import { MemberOtrDataset } from './MemberOtrDataset';
import { ProposalOtrDataset } from './ProposalOtrDataset';
import { SpaceOtrDataset } from './SpaceOtrDataset';
import { StamptOtrDataset } from './StampOtrDataset';
import { TokenOtrDataset } from './TokenOtrDataset';

// prettier-ignore
export type DatasetType<T extends Dataset> = 
  T extends Dataset.MEMBER ? MemberOtrDataset:
  T extends Dataset.SPACE ? SpaceOtrDataset:
  T extends Dataset.TOKEN ? TokenOtrDataset:
  T extends Dataset.PROPOSAL ? ProposalOtrDataset:
  T extends Dataset.STAMP ? StamptOtrDataset:
  unknown;

export interface INativeToken {
  id: string;
  amount: bigint;
}

export abstract class DatasetClass {
  constructor(protected readonly otrAddress: string) {}
}

export class OtrRequest<T> {
  constructor(
    public readonly otrAddress: string,
    public readonly metadata: T,
    public readonly amount?: number,
    public readonly nativeToken?: INativeToken,
  ) {}

  getMetadata = () => ({
    targetAddress: this.otrAddress,
    metadata: { request: this.metadata },
    nativeToken: this.nativeToken,
    tag: this.generateTag(),
    amount: this.amount,
  });

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

  generateTag = () => uuid().replace(/-/g, '');

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

const getFireflyWalletType = (otrAddress: string) => {
  if (otrAddress.startsWith(Network.SMR) || otrAddress.startsWith(Network.RMS)) {
    return 'firefly';
  }
  if (otrAddress.startsWith(Network.IOTA)) {
    return 'iota';
  }
  throw Error('Invalid otr address, ono firefly wallet type found');
};

export const otrAddressToNetwork = (address: string): Network => {
  for (const network of Object.values(Network)) {
    if (address.startsWith(network)) {
      return network as Network;
    }
  }
  throw Error('Invalid otr address');
};
