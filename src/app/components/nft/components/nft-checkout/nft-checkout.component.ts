import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { DeviceService } from '@core/services/device';
import { UnitsHelper } from '@core/utils/units-helper';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  COMPLETE = 'Complete'
}

@Component({
  selector: 'wen-nft-checkout',
  templateUrl: './nft-checkout.component.html',
  styleUrls: ['./nft-checkout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCheckoutComponent {
  @Input() currentStep = StepType.CONFIRM;
  @Input() isOpen = false;
  @Output() onClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public agreeTermsConditions = false;

  constructor(
    public deviceService: DeviceService
  ) {
  }

  public close(): void {
    this.onClose.emit();
    this.isOpen = false;
  }
  
  public copyAddress() {
    // Needs to be implemented
    // if (!this.isCopied && this.transaction$.value?.payload.targetAddress) {
    //   copyToClipboard(this.transaction$.value?.payload.targetAddress)
    //   this.isCopied = true;
    // }
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 4);
  }

  public fireflyDeepLink(): SafeUrl {
    // Needs to be implemented
    return '';
    // if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
    //   return '';
    // }

    // return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.transaction$.value?.payload.targetAddress +
    //        '?amount=' + (this.transaction$.value?.payload.amount / 1000 / 1000) + '&unit=Mi');
  }

  public tanglePayDeepLink(): string {
    // Needs to be implemented
    // if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
    //   return '';
    // }

    return '';
  }
}
