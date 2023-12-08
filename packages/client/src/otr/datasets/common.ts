import { Dataset, Network, TransactionType } from '@build-5/interfaces';
import { INativeToken, utf8ToHex } from '@iota/sdk';
import { switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { API_KEY, Build5 } from '../..';
import { https } from '../../https';
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

export class OtrRequest<T> {
  private tag: string;

  constructor(
    private readonly otrAddress: string,
    private readonly metadata: T,
    private readonly amount?: number,
    private readonly nativeToken?: INativeToken,
  ) {
    this.tag = uuid().replace(/-/g, '');
  }

  getMetadata = async () => {
    const { client } = await getClient(this.otrAddress);
    const data = {
      targetAddress: this.otrAddress,
      amount: this.amount,
      metadata: { request: this.metadata },
      nativeToken: this.nativeToken,
      tag: this.tag,
    };
    const output = await packBasicOutput(client, data);
    return { ...data, amount: output.amount };
  };

  getFireflyDeepLink = async () => {
    const { amount, metadata, nativeToken } = await this.getMetadata();
    const walletType = getFireflyWalletType(this.otrAddress);
    return (
      walletType +
      `://wallet/sendConfirmation?address=${this.otrAddress}` +
      '&disableToggleGift=true&disableChangeExpiration=true' +
      `&amount=${nativeToken ? nativeToken.amount : amount}` +
      `&tag=${this.tag}&giftStorageDeposit=true` +
      `&metadata=${JSON.stringify(metadata)}` +
      (nativeToken ? `&assetId=${nativeToken?.id}` : '')
    );
  };

  getBloomDeepLink = async () => {
    const { amount, metadata, nativeToken } = await this.getMetadata();

    const parameters = {
      address: this.otrAddress,
      baseCoinAmount: Number(amount).toFixed(0),
      tokenId: nativeToken?.id,
      tokenAmount: nativeToken ? Number(nativeToken.amount).toFixed(0) : undefined,
      tag: this.tag,
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

  submit = async (mnemonic: string, customNodeUrl = '') => {
    const { client, info } = await getClient(this.otrAddress, customNodeUrl);
    const wallet = new Wallet(mnemonic, client, info);
    return await wallet.send({
      targetAddress: this.otrAddress,
      metadata: { request: this.metadata },
      amount: this.amount,
      nativeTokens: this.nativeToken,
      tag: this.tag,
    });
  };

  track = () => {
    const origin = this.otrAddress.startsWith(Network.SMR) ? Build5.PROD : Build5.TEST;
    const dataset = https(origin).project(API_KEY[origin]).dataset(Dataset.TRANSACTION);

    const paymentObs = dataset.getPaymentByTagLive(utf8ToHex(this.tag));

    return paymentObs.pipe(
      switchMap(async (payment) => {
        if (!payment) {
          return 'Waiting for payment';
        }
        const result = await dataset.getBySourceTransaction(payment.uid);
        const credit = result.find((t) => t.type === TransactionType.CREDIT_TANGLE_REQUEST);
        if (credit) {
          return JSON.stringify(credit.payload.response);
        }
        const transfer = result.find((t) => t.type === TransactionType.UNLOCK);
        if (transfer) {
          return 'Success';
        }
        return 'Payment not received';
      }),
    );
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
