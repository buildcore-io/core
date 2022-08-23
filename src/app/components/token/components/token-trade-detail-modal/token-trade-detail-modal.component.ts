import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { OrderApi } from '@api/order.api';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsService } from '@core/services/units';
import { environment } from '@env/environment';
import { DEF_WALLET_PAY_IN_PROGRESS, MIN_IOTA_AMOUNT, SERVICE_MODULE_FEE_TOKEN_EXCHANGE, TOKEN_SALE, TOKEN_SALE_TEST } from '@functions/interfaces/config';
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderType, Transaction } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token-trade-detail-modal',
  templateUrl: './token-trade-detail-modal.component.html',
  styleUrls: ['./token-trade-detail-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenTradeDetailModalComponent implements OnDestroy {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() tradeDetailOrder?: TokenTradeOrder;
  @Input()
  set tradeDetailPurchases(value: TokenPurchase[] | TokenPurchase) {
    if (!(value instanceof Array)) {
      value = [value];
    }
    this._tradeDetailPurchases = value;
    this.cancelSubscriptions();
    this.tradeDetailPurchases.forEach(purchase => {
      const { billPaymentId, buyerBillPaymentId, royaltyBillPayments, sellerCreditId, buyerCreditId } = purchase;
      if (billPaymentId) {
        const tempBillPaymentTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined);
        this.subscriptions$.push(this.orderApi.listen(billPaymentId).pipe(untilDestroyed(this)).subscribe(tempBillPaymentTransaction$));
        this.billPaymentTransactions$.push(tempBillPaymentTransaction$);
      }
      if (buyerBillPaymentId) {
        const tempBuyerBillPaymentTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined);
        this.subscriptions$.push(this.orderApi.listen(buyerBillPaymentId).pipe(untilDestroyed(this)).subscribe(tempBuyerBillPaymentTransaction$));
        this.buyerBillPaymentTransactions$.push(tempBuyerBillPaymentTransaction$);
      }
      if (royaltyBillPayments) {
        const tempRoyalBillPaymentsTransaction$ = new BehaviorSubject<Transaction[] | undefined>(undefined);
        this.subscriptions$.push(this.orderApi.listenMultiple(royaltyBillPayments).pipe(untilDestroyed(this)).subscribe(tempRoyalBillPaymentsTransaction$));
        this.royaltyBillPaymentsTransactions$.push(tempRoyalBillPaymentsTransaction$);
      }
      if (sellerCreditId) {
        const tempSellerCreditTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined);
        this.subscriptions$.push(this.orderApi.listen(sellerCreditId).pipe(untilDestroyed(this)).subscribe(tempSellerCreditTransaction$));
        this.sellerCreditTransactions$.push(tempSellerCreditTransaction$);
      }
      if (buyerCreditId) {
        const tempBuyerCreditTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined);
        this.subscriptions$.push(this.orderApi.listen(buyerCreditId).pipe(untilDestroyed(this)).subscribe(tempBuyerCreditTransaction$));
        this.buyerCreditTransactions$.push(tempBuyerCreditTransaction$);
      }
    });
  }
  get tradeDetailPurchases(): TokenPurchase[] {
    return this._tradeDetailPurchases;
  }
  @Output() wenOnClose = new EventEmitter<void>();


  public billPaymentTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public buyerBillPaymentTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public buyerCreditTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public sellerCreditTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public royaltyBillPaymentsTransactions$: BehaviorSubject<Transaction[] | undefined>[] = [];
  private _isOpen = false;
  private _tradeDetailPurchases: TokenPurchase[] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public unitsService: UnitsService,
    public transactionService: TransactionService,
    private cd: ChangeDetectorRef,
    private orderApi: OrderApi
  ) { }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }

  public getWalletStatus(tran: Transaction | undefined | null): string {
    if (tran?.ignoreWallet && tran?.payload?.amount < MIN_IOTA_AMOUNT) {
      return $localize`Non Transferable`;
    } else {
      return $localize`Processing...`;
    }
  }

  public paymentNotProcessedOrInProgress(tran: Transaction | undefined | null): boolean {
    return (!tran?.payload.chainReference && !tran?.payload.walletReference?.chainReference) || tran.payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS);
  }
  
  public get tokenTradeOrderTypes(): typeof TokenTradeOrderType {
    return TokenTradeOrderType;
  }

  public getFee(tran: Transaction | undefined | null): number {
    if (!tran) {
      return 0;
    }

    const config = environment.production ? TOKEN_SALE : TOKEN_SALE_TEST;
    if (tran.space === config.spaceone) {
      return (SERVICE_MODULE_FEE_TOKEN_EXCHANGE / config.spaceonepercentage) / 100;
    } else if (tran.space === config.spacetwo) {
      return (SERVICE_MODULE_FEE_TOKEN_EXCHANGE - (SERVICE_MODULE_FEE_TOKEN_EXCHANGE / config.spaceonepercentage)) / 100;
    } else {
      return 0;
    }
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
    this.billPaymentTransactions$ = [];
    this.buyerBillPaymentTransactions$ = [];
    this.royaltyBillPaymentsTransactions$ = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
