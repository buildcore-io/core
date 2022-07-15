import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TokenMintApi } from '@api/token_mint.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Network, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Timestamp } from '@functions/interfaces/models/base';
import { Token } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

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
  selector: 'wen-token-mint-network',
  templateUrl: './token-mint-network.component.html',
  styleUrls: ['./token-mint-network.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenMintNetworkComponent implements OnInit {
  @Input() currentStep = StepType.SELECT;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Output() wenOnClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public selectedNetwork?: Network;
  public agreeTermsConditions = false;
  public targetAddress?: string = 'dummy_address';
  public targetAmount?: number = 1200000;
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public invalidPayment = false;
  public history: HistoryItem[] = [];
  private transSubscription?: Subscription;
  private _isOpen = false;

  constructor(
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private notification: NotificationService,
    private tokenMintApi: TokenMintApi
  ) { }

  public ngOnInit(): void {
    // TODO: this needs to be implemented
    const listeningToTransaction: string[] = [];
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER) {
        this.targetAddress = val.payload.targetAddress;
        this.targetAmount = val.payload.amount;
        if (val.payload.expiresOn) {
          const expiresOn: dayjs.Dayjs = dayjs(val.payload.expiresOn.toDate());
          if (expiresOn.isBefore(dayjs())) {
            return;
          }
          this.expiryTicker$.next(expiresOn);
        }
      }

      this.cd.markForCheck();
    });

    // Run ticker.
    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.expiryTicker$.next(this.expiryTicker$.value);

      // If it's in the past.
      if (this.expiryTicker$.value) {
        const expiresOn: dayjs.Dayjs = dayjs(this.expiryTicker$.value);
        if (expiresOn.isBefore(dayjs())) {
          this.expiryTicker$.next(null);
          int.unsubscribe();
          this.reset();
        }
      }
    });
  }

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

  public async proceedWithMint(): Promise<void> {
    if (!this.token || this.selectedNetwork === undefined || !this.agreeTermsConditions) {
      return;
    }

    const params: any = {
      token: this.token.uid,
      targetNetwork: this.selectedNetwork
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMintApi.mintToken(sc), 'Order created.', finish).subscribe((val: any) => {
        this.transSubscription?.unsubscribe();
        this.transSubscription = this.tokenMintApi.listen(val.uid).subscribe(<any> this.transaction$);
      });
    });
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatUnits(Number(amount), 'Mi');
  }

  public get networkTypes(): typeof Network {
    return Network;
  }
}
