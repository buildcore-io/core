import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { UnitsHelper } from '@core/utils/units-helper';
import { Token, TokenAllocation } from '@functions/interfaces/models/token';
import dayjs from 'dayjs';

@Component({
  selector: 'wen-token-public-sale',
  templateUrl: './token-public-sale.component.html',
  styleUrls: ['./token-public-sale.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPublicSaleComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Output() wenOnClose = new EventEmitter<void>();

  public startDateControl: FormControl = new FormControl('', Validators.required);
  public offerLengthControl: FormControl = new FormControl(2, [Validators.required, Validators.min(1)]);
  public cooldownLengthControl: FormControl = new FormControl(2, [Validators.required]);
  public enableCooldownControl: FormControl = new FormControl(true);
  public autoProcessAt100PercentControl: FormControl = new FormControl(true);
  public scheduleSaleForm: FormGroup;
  public offeringLengthOptions = Array.from({length: 3}, (_, i) => i + 1)
  public cooldownLengthOptions = Array.from({length: 3}, (_, i) => i + 1)
  public allocationInfoLabels: string[] = [$localize`Price per token`, $localize`Public sale`];
  private _isOpen = false;

  constructor(
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private notification: NotificationService,
    private tokenApi: TokenApi
  ) {
    this.scheduleSaleForm = new FormGroup({
      startDate: this.startDateControl,
      offerLength: this.offerLengthControl,
      cooldownLength: this.cooldownLengthControl,
      enableCooldown: this.enableCooldownControl,
      autoProcessAt100Percent: this.autoProcessAt100PercentControl
    });
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }

  public disabledStartDate(startValue: Date): boolean {
    // Disable past dates & today + 1day startValue
    if (startValue.getTime() < dayjs().toDate().getTime()) {
      return true;
    }

    return false;
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatUnits(Number(amount), 'Mi');
  }

  public publicAllocation(allocations?: TokenAllocation[]): TokenAllocation| undefined {
    return allocations?.find(a => a.isPublicSale);
  }

  public percentageMarketCap(): number {
    if (!this.token) {
      return 0;
    }
    return (this.token?.pricePerToken * (this.token?.totalSupply) / 100 * Number(this.publicAllocation(this.token?.allocations)?.percentage || 0));
  }

  private validateForm(): boolean {
    this.scheduleSaleForm.updateValueAndValidity();
    if (!this.scheduleSaleForm.valid) {
      Object.values(this.scheduleSaleForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      return false;
    }
    return true;
  }

  public formatSubmitData(data: any): any {
    const res: any = {};

    res.token = this.token?.uid;
    res.saleStartDate = data.startDate;

    res.saleLength = data.offerLength * 24 * 60 * 60 * 1000;
    res.coolDownLength = data.enableCooldown ? data.cooldownLength * 24 * 60 * 60 * 1000 : 0;
    res.autoProcessAt100Percent = data.autoProcessAt100Percent;

    // Will be removed in the future. Might use this to set the public sale dates
    // For testing purposes.
    // if (!environment.production) {
    //   res.saleLength = 10 * 60 * 1000;
    //   res.coolDownLength = 5 * 60 * 1000;
    // } else {
    //   res.saleLength = data.offerLength * 24 * 60 * 60 * 1000;
    //   res.coolDownLength = 24 * 60 * 60 * 1000;
    // }

    return res;
  }

  public async scheduleSale(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    await this.auth.sign(
      this.formatSubmitData(this.scheduleSaleForm.value),
      (sc, finish) => {
        this.notification
          .processRequest(this.tokenApi.setTokenAvailableForSale(sc), 'Scheduled public sale.', finish)
          .subscribe(() => this.close());
      },
    );
  }
}
