import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TokenWithMemberDistribution } from '@api/member.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';

export enum TokenItemType {
  CLAIM = 'Claim',
  REFUND = 'Refund'
};


@Component({
  selector: 'wen-token-claim-refund',
  templateUrl: './token-claim-refund.component.html',
  styleUrls: ['./token-claim-refund.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenClaimRefundComponent {
  @Input() type: TokenItemType | null = null;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: TokenWithMemberDistribution | null;
  @Output() wenOnClose = new EventEmitter<void>();
  
  public amountControl: FormControl = new FormControl(null);
  public agreeTermsConditions = false;
  private _isOpen = false;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private notification: NotificationService
  ) { }

  public get tokenItemTypes(): typeof TokenItemType {
    return TokenItemType;
  }
  
  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }
  
  public reset(): void {
    this.isOpen = false;
    this.type = TokenItemType.CLAIM;
    this.cd.markForCheck();
  }

  public getTitle(): string {
    switch (this.type) {
    case TokenItemType.CLAIM:
      return $localize`Claim token`;
    case TokenItemType.REFUND:
      return $localize`Refund token`;
    default:
      return '';
    }
  }

  public dropsSum(): number | undefined {
    return this.token?.distribution?.tokenDrops?.reduce((pv, cv) => pv + cv.count, 0);
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount).toFixed(2);
  }

  public async confirm(): Promise<void> {
    switch (this.type) {
    case TokenItemType.CLAIM: {
      const data = {
        token: this.token?.uid
      };
      await this.auth.sign(
        data,
        (sc, finish) => {
          this.notification
            .processRequest(this.tokenApi.claimAirdroppedToken(sc), 'Token successfully claimed.', finish)
            .subscribe(() => this.close());
        },
      );
      break;
    }
    case TokenItemType.REFUND: {
      const data = {
        token: this.token?.uid,
        amount: Number(this.amountControl.value) * 1000 * 1000
      };
      await this.auth.sign(
        data,
        (sc, finish) => {
          this.notification
            .processRequest(this.tokenApi.creditToken(sc), 'Token successfully refunded.', finish)
            .subscribe(() => this.close());
        },
      );
      break;
    }
    }
  }
}
