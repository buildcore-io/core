import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { OrderApi } from '@api/order.api';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsService } from '@core/services/units';
import { Token, TokenPurchase, TokenTradeOrderType, Transaction } from '@functions/interfaces/models';
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
  @Input()
  set tradeDetailPurchases(value: TokenPurchase[] | TokenPurchase) {
    if (!(value instanceof Array)) {
      value = [value];
      this.isSinglePurchase = true;
    } else {
      this.isSinglePurchase = false;
    }
    this._tradeDetailPurchases = value;
    this.cancelSubscriptions();
    this.tradeDetailPurchases.forEach(purchase => {
      const { billPaymentId, buyerBillPaymentId, royaltyBillPayments } = purchase;
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
    });
  }
  get tradeDetailPurchases(): TokenPurchase[] {
    return this._tradeDetailPurchases;
  }
  @Output() wenOnClose = new EventEmitter<void>();


  public billPaymentTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public buyerBillPaymentTransactions$: BehaviorSubject<Transaction | undefined>[] = [];
  public royaltyBillPaymentsTransactions$: BehaviorSubject<Transaction[] | undefined>[] = [];
  public isSinglePurchase = false;
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

  public get tokenTradeOrderTypes(): typeof TokenTradeOrderType {
    return TokenTradeOrderType;
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
