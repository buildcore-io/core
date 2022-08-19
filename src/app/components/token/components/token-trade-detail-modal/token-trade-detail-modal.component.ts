import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { Token, TokenPurchase } from '@functions/interfaces/models';

@Component({
  selector: 'wen-token-trade-detail-modal',
  templateUrl: './token-trade-detail-modal.component.html',
  styleUrls: ['./token-trade-detail-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenTradeDetailModalComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() openTokenPurchaseDetail?: TokenPurchase;
  @Output() wenOnClose = new EventEmitter<void>();

  private _isOpen = false;

  constructor(
    public previewImageService: PreviewImageService,
    public unitsService: UnitsService,
    private cd: ChangeDetectorRef
  ) {
    // Leave this for future use while working on this task
    // setTimeout(() => {
    //   console.log(this.token, this.openTokenPurchaseDetail);
    // }, 1000);
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public reset(): void {
    this.isOpen = false;
    this.cd.markForCheck();
  }
}
