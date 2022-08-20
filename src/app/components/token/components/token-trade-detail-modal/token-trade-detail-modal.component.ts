import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { OrderApi } from '@api/order.api';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsService } from '@core/services/units';
import { Member, Token, TokenPurchase, TokenTradeOrderType, Transaction } from '@functions/interfaces/models';
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
  set openTokenPurchaseDetail(value: TokenPurchase | undefined) {
    this._openTokenPurchaseDetail = value;
    this.cancelSubscriptions();
    if (!this.openTokenPurchaseDetail) return;
    const { billPaymentId, buyerBillPaymentId, royaltyBillPayments } = this.openTokenPurchaseDetail;
    if (!billPaymentId || !buyerBillPaymentId || !royaltyBillPayments) return;
    this.subscriptions$.push(this.orderApi.listen(billPaymentId).pipe(untilDestroyed(this)).subscribe(this.billPaymentTransaction$));
    this.subscriptions$.push(this.orderApi.listen(buyerBillPaymentId).pipe(untilDestroyed(this)).subscribe(this.buyerBillPaymentTransaction$));
    this.subscriptions$.push(this.orderApi.listenMultiple(royaltyBillPayments).pipe(untilDestroyed(this)).subscribe(this.royaltyBillPaymentsTransactions$));
  }
  get openTokenPurchaseDetail(): TokenPurchase | undefined {
    return this._openTokenPurchaseDetail;
  }
  @Output() wenOnClose = new EventEmitter<void>();


  public billPaymentTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined)
  public buyerBillPaymentTransaction$ = new BehaviorSubject<Transaction | undefined>(undefined)
  public royaltyBillPaymentsTransactions$ = new BehaviorSubject<Transaction[] | undefined>(undefined)
  public sellerMember$ = new BehaviorSubject<Member | undefined>(undefined);
  private _isOpen = false;
  private _openTokenPurchaseDetail: TokenPurchase | undefined;
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public unitsService: UnitsService,
    public transactionService: TransactionService,
    private cd: ChangeDetectorRef,
    private orderApi: OrderApi
  ) {
    // Leave this for future use while working on this task
    // setTimeout(() => {
    //   console.log(this.token, this.openTokenPurchaseDetail);
    // }, 1000);
    // this.billPaymentTransaction$.subscribe(r => console.log(r));
    // this.buyerBillPaymentTransaction$.subscribe(r => console.log(r));
    // this.royaltyBillPaymentsTransactions$.subscribe(r => console.log(r));
  }

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
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
