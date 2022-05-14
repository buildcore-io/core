import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space } from '@functions/interfaces/models';
import { Token } from '@functions/interfaces/models/token';
import * as dayjs from 'dayjs';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  COMPLETE = 'Complete'
}

@Component({
  selector: 'wen-token-purchase',
  templateUrl: './token-purchase.component.html',
  styleUrls: ['./token-purchase.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPurchaseComponent {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() space?: Space;
  @Output() wenOnClose = new EventEmitter<void>();

  public amountControl: FormControl = new FormControl(null);
  public agreeTermsConditions = false;
  public targetAddress?: string = 'dummy_address';
  public targetAmount?: number;
  public isCopied = false;
  private _isOpen = false;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef
  ) { }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '0 IOTA';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public getEndDate(): dayjs.Dayjs {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms');
  }

  public reset(): void {
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
    this.cd.markForCheck();
  }

  public get stepType(): typeof StepType {
    return StepType;
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
}
