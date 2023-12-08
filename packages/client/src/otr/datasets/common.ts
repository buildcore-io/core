import { Dataset, Network } from '@build-5/interfaces';
import { INativeToken } from '@iota/sdk';
import { v4 as uuid } from 'uuid';
import { getClient } from '../wallet/client';
import { packBasicOutput } from '../wallet/output';
import { Wallet } from '../wallet/wallet';
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

export abstract class DatasetClass {
  constructor(protected readonly otrAddress: string) {}
}

interface DeeplinkResponse {
  deeplink: string;
  tag: string;
}

export class OtrRequest<T> {
  constructor(
    private readonly otrAddress: string,
    private readonly metadata: T,
    private readonly amount?: number,
    private readonly nativeToken?: INativeToken,
  ) {}

  getMetadata = async () => {
    const { client } = await getClient(this.otrAddress);
    const data = {
      targetAddress: this.otrAddress,
      amount: this.amount,
      metadata: { request: this.metadata },
      nativeToken: this.nativeToken,
      tag: this.getTag(),
    };
    const output = await packBasicOutput(client, data);
    return { ...data, amount: output.amount };
  };

  getFireflyDeepLink = async (): Promise<DeeplinkResponse> => {
    const { amount, metadata, nativeToken, tag } = await this.getMetadata();
    const walletType = getFireflyWalletType(this.otrAddress);
    return {
      deeplink:
        walletType +
        `://wallet/sendConfirmation?address=${this.otrAddress}` +
        '&disableToggleGift=true&disableChangeExpiration=true' +
        `&amount=${nativeToken ? nativeToken.amount : amount}` +
        `&tag=${tag}&giftStorageDeposit=true` +
        `&metadata=${JSON.stringify(metadata)}` +
        (nativeToken ? `&assetId=${nativeToken?.id}` : ''),
      tag,
    };
  };

  getBloomDeepLink = async (): Promise<DeeplinkResponse> => {
    const { amount, metadata, nativeToken, tag } = await this.getMetadata();

    const parameters = {
      address: this.otrAddress,
      baseCoinAmount: Number(amount).toFixed(0),
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

    return { deeplink: `bloom://wallet/sendTransaction?${searchParams}`, tag };
  };

  submit = (wallet: Wallet) =>
    wallet.send({
      targetAddress: this.otrAddress,
      metadata: { request: this.metadata },
      amount: this.amount,
      nativeTokens: this.nativeToken,
      tag: this.getTag(),
    });

  private getTag = () => uuid().replace(/-/g, '');
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
