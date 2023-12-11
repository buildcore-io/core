import {
  Dataset,
  Network,
  TangleResponse,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { Observable as RxjsObservable, Subscriber, Subscription } from 'rxjs';
import { API_KEY, Build5, https } from '../https';
import { TransactionDataset } from '../https/datasets/TransactionDataset';
import { AuctionOtrDataset } from './datasets/AuctionOtrDataset';
import { AwardOtrDataset } from './datasets/AwardOtrDataset';
import { MemberOtrDataset } from './datasets/MemberOtrDataset';
import { NftOtrDataset } from './datasets/NftOtrDataset';
import { ProposalOtrDataset } from './datasets/ProposalOtrDataset';
import { SpaceOtrDataset } from './datasets/SpaceOtrDataset';
import { TokenOtrDataset } from './datasets/TokenOtrDataset';
import { DatasetType } from './datasets/common';

export class OtrWrapper {
  constructor(private readonly otrAddress: string) {}

  dataset<D extends Dataset>(dataset: D): DatasetType<D> {
    switch (dataset) {
      case Dataset.AUCTION:
        return new AuctionOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.AWARD:
        return new AwardOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.MEMBER:
        return new MemberOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.NFT:
        return new NftOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.PROPOSAL:
        return new ProposalOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.SPACE:
        return new SpaceOtrDataset(this.otrAddress) as DatasetType<D>;
      case Dataset.TOKEN:
        return new TokenOtrDataset(this.otrAddress) as DatasetType<D>;
      default:
        throw Error('invalid dataset name');
    }
  }

  trackByTag = (tag: string) => {
    const origin = this.otrAddress.startsWith(Network.SMR) ? Build5.PROD : Build5.TEST;
    return new Observable(origin, tag);
  };
}

class Observable extends RxjsObservable<TangleResponse> {
  private observer: Subscriber<TangleResponse> | undefined;
  private paymentsSubs: Subscription | undefined;
  private payments: string[] = [];
  private dataset: TransactionDataset<Dataset.TRANSACTION> | undefined;

  constructor(origin: Build5, tag: string) {
    super((observer) => {
      this.observer = observer;

      this.dataset = https(origin).project(API_KEY[origin]).dataset(Dataset.TRANSACTION);
      this.observer.next({ status: 'waiting for payment' });

      this.paymentsSubs = this.dataset
        .getPaymentByTagLive(tag.startsWith('0x') ? tag : toHex(tag))
        .subscribe(async (payments) => {
          payments.sort((a, b) => a.createdOn?.seconds! - b.createdOn?.seconds!);
          for (const payment of payments) {
            await this.getResponseForPayment(payment);
          }
        });

      return this.closeConnection;
    });
  }

  private getResponseForPayment = async (payment: Transaction) => {
    if (this.payments.includes(payment.uid)) {
      return;
    }
    this.payments.push(payment.uid);

    for (let i = 0; i < 10; ++i) {
      const result = await this.dataset!.getBySourceTransaction(payment.uid);
      const credit = result.find((t) => t.type === TransactionType.CREDIT_TANGLE_REQUEST);
      if (credit) {
        this.observer?.next(credit.payload.response);
        return;
      }
      const transfer = result.find((t) => t.type === TransactionType.UNLOCK);
      if (transfer) {
        this.observer?.next({ status: 'success' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  private closeConnection = () => {
    this.paymentsSubs?.unsubscribe();
    this.observer?.complete();
  };
}

const toHex = (stringToConvert: string) =>
  '0x' +
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
