import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Collection, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Timestamp } from '@functions/interfaces/models/base';
import { UntilDestroy } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { BehaviorSubject } from 'rxjs';

export enum StepType {
  SELECT = 'Select',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  CONFIRMED = 'Confirmed'
}

interface HistoryItem {
  uniqueId: string;
  date: dayjs.Dayjs|Timestamp|null;
  label: string;
  link?: string;
}

@UntilDestroy()
@Component({
  selector: 'wen-collection-mint-network',
  templateUrl: './collection-mint-network.component.html',
  styleUrls: ['./collection-mint-network.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionMintNetworkComponent {
  @Input() currentStep = StepType.SELECT;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() collection?: Collection;
  @Output() wenOnClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public agreeTermsConditions = false;
  public targetAddress?: string = 'dummy_address';
  public targetAmount?: number = 1200000;
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public invalidPayment = false;
  public history: HistoryItem[] = [];
  private _isOpen = false;

  constructor(
    private cd: ChangeDetectorRef
  ) { }

  public get lockTime(): number {
    return TRANSACTION_AUTO_EXPIRY_MS / 1000 / 60;
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
  }

  public copyAddress() {
    if (!this.isCopied && this.targetAddress) {
      copyToClipboard(this.targetAddress);
      this.isCopied = true;
      setTimeout(() => {
        this.isCopied = false;
        this.cd.markForCheck();
      }, 3000);
    }
  }

  public reset(): void {
    this.isOpen = false;
    this.currentStep = StepType.SELECT;
    this.cd.markForCheck();
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }
}
