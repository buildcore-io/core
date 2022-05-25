import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'wen-wallet-deeplink',
  templateUrl: './wallet-deeplink.component.html',
  styleUrls: ['./wallet-deeplink.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletDeeplinkComponent {
  @Input()
  set targetAddress(value: string | undefined) {
    this._targetAddress = value;
    this.setLinks();
  }
  get targetAddress(): string | undefined {
    return this._targetAddress;
  }
  @Input()
  set targetAmount(value: string | undefined) {
    this._targetAmount = value;
    this.setLinks();
  }
  get targetAmount(): string | undefined {
    return this._targetAmount;
  }

  public fireflyDeepLink?: SafeUrl;
  public tanglePayDeepLink?: SafeUrl;
  private _targetAddress?: string;
  private _targetAmount?: string;

  constructor(
    private sanitizer: DomSanitizer
  ) {}

  private setLinks(): void {
    this.fireflyDeepLink = this.getFireflyDeepLink();
    this.tanglePayDeepLink = this.getTanglePayDeepLink();
  }

  private getFireflyDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    // We want to round to maximum 6 digits.
    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.targetAddress +
      '?amount=' + +Number(this.targetAmount).toFixed(6) + '&unit=Mi');
  }

  private getTanglePayDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('tanglepay://send/' + this.targetAddress +
      '?value=' + +Number(this.targetAmount).toFixed(6) + '&unit=Mi' + '&merchant=Soonaverse');
  }
}
