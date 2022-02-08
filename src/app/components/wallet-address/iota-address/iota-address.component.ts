import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { OrderApi } from "@api/order.api";
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Member, Space } from '../../../../../functions/interfaces/models';
import { TransactionOrder, TransactionType } from './../../../../../functions/interfaces/models/transaction';
import { EntityType } from './../wallet-address.component';

export enum StepType {
  GENERATE = 'Generate',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  CONFIRMED = 'Confirmed'
}

@UntilDestroy()
@Component({
  selector: 'wen-iota-address',
  templateUrl: './iota-address.component.html',
  styleUrls: ['./iota-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IOTAAddressComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.GENERATE;
  @Input() entityType?: EntityType;
  @Input() entity?: Space|Member|null;

  public stepType = StepType;
  public isCopied = false;
  public transaction$: BehaviorSubject<TransactionOrder|undefined> = new BehaviorSubject<TransactionOrder|undefined>(undefined);
  private transSubscription?: Subscription;

  constructor(
    public deviceService: DeviceService,
    private auth: AuthService,
    private notification: NotificationService,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private orderApi: OrderApi
  ) {
  }

  public ngOnInit(): void {
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER && val.linkedTransactions?.length > 0) {
        this.currentStep = StepType.WAIT;
        // Listen to other transactions.
        for (const tranId of val.linkedTransactions) {
          this.orderApi.listen(tranId).pipe(untilDestroyed(this)).subscribe(<any>this.transaction$);
        }
      } else if (val && val.type === TransactionType.ORDER && !val.linkedTransactions) {
        this.currentStep = StepType.TRANSACTION;
      } else if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true) {
        this.currentStep = StepType.CONFIRMED;
      }

      this.cd.markForCheck();
    });
  }

  public copyAddress() {
    if (!this.isCopied && this.transaction$.value?.payload.targetAddress) {
      copyToClipboard(this.transaction$.value?.payload.targetAddress)
      this.isCopied = true;
    }
  }

  public fireflyDeepLink(): SafeUrl {
    if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.transaction$.value?.payload.targetAddress +
           '?amount=' + this.transaction$.value?.payload.amount + '&unit=i');
  }

  public tanglePayDeepLink(): string {
    if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
      return '';
    }

    return '';
  }

  public async initVerification(): Promise<void> {
    if (!this.entity) {
      return;
    }

    const params: any = {};
    if (this.entityType === EntityType.SPACE) {
      params.space = this.entity.uid;
    }

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.orderApi.validateAddress(sc), 'Validation requested.', finish).subscribe((val: any) => {
        this.transSubscription?.unsubscribe();
        this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any>this.transaction$);
      });
    });
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
