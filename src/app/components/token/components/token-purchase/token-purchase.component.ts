import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { copyToClipboard } from '@core/utils/tools.utils';

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
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer
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

  public fireflyDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.targetAddress +
           '?amount=' + (this.targetAmount / 1000 / 1000) + '&unit=Mi');
  }

  public tanglePayDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('tanglepay://send/' + this.targetAddress + '?value=' + (this.targetAmount / 1000 / 1000) + '&unit=Mi' + '&merchant=Soonaverse');
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
