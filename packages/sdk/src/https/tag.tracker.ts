import { Dataset, TangleResponse, Transaction, TransactionType } from '@build-5/interfaces';
import { Observable as RxjsObservable, Subscriber, Subscription } from 'rxjs';
import { Build5, SoonaverseApiKey, https } from '../https';
import { TransactionDataset } from '../https/datasets/TransactionDataset';

export interface TagTrackResult extends TangleResponse {
  chainReference?: string;
}

/**
 * Enhanced observable to track OTR transaction on Tangle / Build.5
 */
export class Observable extends RxjsObservable<TagTrackResult> {
  private observer: Subscriber<TagTrackResult> | undefined;
  private dataset: TransactionDataset<Dataset.TRANSACTION> | undefined;
  private transactionIds: string[] = [];
  private subs: { [key: string]: Subscription } = {};

  constructor(origin: Build5, tag: string) {
    super((observer) => {
      this.observer = observer;

      this.dataset = https(origin).project(SoonaverseApiKey[origin]).dataset(Dataset.TRANSACTION);
      this.observer.next({ status: 'waiting for payment' });

      this.subs['payment'] = this.dataset
        .getPaymentByTagLive(tag.startsWith('0x') ? tag : toHex(tag))
        .subscribe(async (payments) => {
          payments.sort((a, b) => a.createdOn?.seconds! - b.createdOn?.seconds!);
          for (const payment of payments) {
            if (!this.transactionIds.includes(payment.uid)) {
              this.transactionIds.push(payment.uid);
              this.observer?.next({
                status: 'payment received',
                chainReference: payment.payload.chainReference || '',
              });
              this.getResponseForPayment(payment);
            }
          }
        });

      return this.closeConnection;
    });
  }

  private getResponseForPayment = (payment: Transaction) => {
    const obs = this.dataset!.getBySourceTransactionLive(payment.uid);
    this.subs[payment.uid] = obs.subscribe((transactions) => {
      for (const tran of transactions) {
        if (!this.transactionIds.includes(tran.uid)) {
          this.transactionIds.push(tran.uid);

          if (tran.type === TransactionType.CREDIT_TANGLE_REQUEST) {
            this.observer?.next({
              ...tran.payload.response,
              chainReference: tran.payload.walletReference?.chainReference || '',
            });
            return;
          }

          if (tran.type === TransactionType.UNLOCK) {
            this.observer?.next({ status: 'Success' });
            return;
          }
        }
      }
    });
  };

  private closeConnection = () => {
    Object.values(this.subs).forEach((subs) => subs.unsubscribe());
    this.observer?.complete();
  };
}

const toHex = (stringToConvert: string) =>
  '0x' +
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
