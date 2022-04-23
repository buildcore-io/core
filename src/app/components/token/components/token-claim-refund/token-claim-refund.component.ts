import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';

export enum TokenItemType {
  CLAIM = 0,
  REFUND = 1
};


@Component({
  selector: 'wen-token-claim-refund',
  templateUrl: './token-claim-refund.component.html',
  styleUrls: ['./token-claim-refund.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenClaimRefundComponent {
  @Input() type = TokenItemType.CLAIM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Output() wenOnClose = new EventEmitter<void>();
  
  public agreeTermsConditions = false;
  private _isOpen = false;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef
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
}
