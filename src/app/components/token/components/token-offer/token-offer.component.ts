import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { copyToClipboard } from '@core/utils/tools.utils';
import { Token } from '@functions/interfaces/models/token';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  COMPLETE = 'Complete'
}

@Component({
  selector: 'wen-token-offer',
  templateUrl: './token-offer.component.html',
  styleUrls: ['./token-offer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenOfferComponent {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Output() wenOnClose = new EventEmitter<void>();

  public amountControl: FormControl = new FormControl(null);
  public agreeTermsConditions = false;
  public agreeTokenTermsConditions = false;
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
