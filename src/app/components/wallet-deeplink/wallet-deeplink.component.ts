import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Network } from '@functions/interfaces/models';

@Component({
  selector: 'wen-wallet-deeplink',
  templateUrl: './wallet-deeplink.component.html',
  styleUrls: ['./wallet-deeplink.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletDeeplinkComponent {
  @Input()
  set network(value: Network | undefined | null) {
    this._network = value || undefined;
    this.setLinks();
  }
  get network(): Network | undefined {
    return this._network;
  }
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
  @Input()
  set tokenId(value: string | undefined) {
    this._tokenId = value;
    this.setLinks();
  }
  get tokenId(): string | undefined {
    return this._tokenId;
  }
  @Input()
  set tokenAmount(value: number | undefined) {
    this._tokenAmount = value;
    this.setLinks();
  }
  get tokenAmount(): number | undefined {
    return this._tokenAmount;
  }

  public fireflyDeepLink?: SafeUrl;
  public tanglePayDeepLink?: SafeUrl;
  private _targetAddress?: string;
  private _network?: Network;
  private _targetAmount?: string;
  private _tokenId?: string;
  private _tokenAmount?: number;

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

    // TEMP
    if (this._tokenId || this._tokenAmount) {
      return '';
    }

    // We want to round to maximum 6 digits.
    if (this.network === Network.RMS) {
      //  firefly-beta://wallet/sendConfirmation?address=rms1qrut5ajyfrtgjs325kd9chwfwyyy2z3fewy4vgy0vvdtf2pr8prg5u3zwjn&amount=100&metadata=128347213&tag=soonaverse
      return this.sanitizer.bypassSecurityTrustUrl('firefly-beta://wallet/sendConfirmation?address=' + this.targetAddress +
        '&amount=' + Number(this.targetAmount).toFixed(6) + '&tag=soonaverse&giftStorageDeposit=false');
    } else if (this.network === Network.SMR) {
      //  firefly://wallet/sendConfirmation?address=rms1qrut5ajyfrtgjs325kd9chwfwyyy2z3fewy4vgy0vvdtf2pr8prg5u3zwjn&amount=100&metadata=128347213&tag=soonaverse
      return this.sanitizer.bypassSecurityTrustUrl('firefly://wallet/sendConfirmation?address=' + this.targetAddress +
        '&amount=' + Number(this.targetAmount).toFixed(6) + '&tag=soonaverse&giftStorageDeposit=false');
    } else {
      return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.targetAddress +
      '?amount=' + +Number(this.targetAmount).toFixed(6) + '&unit=Mi');
    }
  }

  private getTanglePayDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('tanglepay://send/' + this.targetAddress +
      '?value=' + +Number(this.targetAmount).toFixed(6) + '&unit=Mi' + '&merchant=Soonaverse');
  }
}
